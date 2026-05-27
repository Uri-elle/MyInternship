const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const path = require("path");

const app = express();

// Middleware pour lire le JSON et les formulaires HTML
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rendre les pages HTML/CSS accessibles publiquement
app.use(express.static(path.join(__dirname)));

// 1. Connexion à la base de données MySQL
const db = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "", // mot de passe MySQL Workbench
  database: "MyInternshipDB",
});

db.connect((err) => {
  if (err) {
    console.error("Erreur de connexion à la base de données :", err);
    return;
  }
  console.log("Connecté avec succès à la base MyInternshipDB !");
});

// =========================================================================
// 2. AUTHENTIFICATION & COMPTES (Connexion & Inscriptions)
// =========================================================================

// Connexion universelle (Étudiant, Entreprise, Admin)
app.post("/api/login", (req, res) => {
  const { email, mdp } = req.body;

  const query = "select * from Utilisateurs where email = ?";
  db.query(query, [email], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0)
      return res.status(401).json({ error: "Identifiants incorrects." });

    const user = results[0];
    const match = await bcrypt.compare(mdp, user.mdp);
    if (!match)
      return res.status(401).json({ error: "Identifiants incorrects." });

    // Si c'est un étudiant ou une entreprise, on récupère son ID spécifique lié
    if (user.role === "Etudiant") {
      db.query(
        "select id_Et from Etudiants where id_U = ?",
        [user.id_U],
        (errEt, resEt) => {
          if (errEt || resEt.length === 0)
            return res
              .status(500)
              .json({ error: "Profil étudiant introuvable." });
          res.json({
            message: "Connexion réussie !",
            role: user.role,
            id_U: user.id_U,
            id_specific: resEt[0].id_Et,
          });
        },
      );
    } else if (user.role === "Entreprise") {
      db.query(
        "select id_E from Entreprises where id_U = ?",
        [user.id_U],
        (errE, resE) => {
          if (errE || resE.length === 0)
            return res
              .status(500)
              .json({ error: "Profil entreprise introuvable." });
          res.json({
            message: "Connexion réussie !",
            role: user.role,
            id_U: user.id_U,
            id_specific: resE[0].id_E,
          });
        },
      );
    } else {
      // Pour l'administrateur
      res.json({
        message: "Connexion admin réussie !",
        role: user.role,
        id_U: user.id_U,
      });
    }
  });
});

// Inscription Étudiant
app.post("/api/register-student", async (req, res) => {
  const { email, mdp, nom, prenom, formation } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(mdp, 10);
    db.query(
      "insert into Utilisateurs (email, mdp, role) values (?, ?, 'Etudiant')",
      [email, hashedPassword],
      (err, result) => {
        if (err)
          return res.status(400).json({
            error:
              err.code === "ER_DUP_ENTRY"
                ? "Cet email est déjà utilisé."
                : err.message,
          });

        db.query(
          "insert into Etudiants (id_U, nom, prenom, formation) values (?, ?, ?, ?)",
          [result.insertId, nom, prenom, formation],
          (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res
              .status(201)
              .json({ message: "Compte étudiant créé avec succès !" });
          },
        );
      },
    );
  } catch (e) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Inscription Entreprise
app.post("/api/register-company", async (req, res) => {
  const { email, mdp, nom_entreprise, adresse, secteur, siret } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(mdp, 10);
    db.query(
      "insert into Utilisateurs (email, mdp, role) values (?, ?, 'Entreprise')",
      [email, hashedPassword],
      (err, result) => {
        if (err)
          return res.status(400).json({
            error:
              err.code === "ER_DUP_ENTRY"
                ? "Cet email est déjà utilisé."
                : err.message,
          });

        db.query(
          "insert into Entreprises (id_U, nom_entreprise, adresse, secteur, siret) values (?, ?, ?, ?, ?)",
          [result.insertId, nom_entreprise, adresse, secteur, siret],
          (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res
              .status(201)
              .json({ message: "Compte entreprise créé avec succès !" });
          },
        );
      },
    );
  } catch (e) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// =========================================================================
// 3. FONCTIONNALITÉS ENTREPRISES (Offres & Profil)
// =========================================================================

// Publier une offre (RG2)
app.post("/api/offers", (req, res) => {
  const { id_E, titre, description, date_debut, mot_cle } = req.body;
  const query =
    "insert into Offres (id_E, titre, description, date_debut, mot_cle) values (?, ?, ?, ?, ?)";
  db.query(query, [id_E, titre, description, date_debut, mot_cle], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Offre de stage publiée avec succès !" });
  });
});

// Consulter les offres publiées par UNE entreprise spécifique
app.get("/api/companies/:id_E/offers", (req, res) => {
  db.query(
    "select * from Offres where id_E = ? order by date_publication desc",
    [req.params.id_E],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    },
  );
});

// Mettre à jour une offre de stage
app.put("/api/offers/:id_O", (req, res) => {
  const { titre, description, date_debut, mot_cle } = req.body;
  const query =
    "update Offres set titre = ?, description = ?, date_debut = ?, mot_cle = ? where id_O = ?";
  db.query(
    query,
    [titre, description, date_debut, mot_cle, req.params.id_O],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Offre mise à jour avec succès !" });
    },
  );
});

// Supprimer une offre de stage (Nettoie automatiquement les candidatures grâce au CASCADE)
app.delete("/api/offers/:id_O", (req, res) => {
  db.query("delete from Offres where id_O = ?", [req.params.id_O], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Offre supprimée définitivement !" });
  });
});

// Récupérer et modifier le profil de l'entreprise
app.get("/api/companies/:id_E", (req, res) => {
  db.query(
    "select e.*, u.email from Entreprises e join Utilisateurs u on e.id_U = u.id_U where e.id_E = ?",
    [req.params.id_E],
    (err, results) => {
      if (err || results.length === 0)
        return res.status(404).json({ error: "Profil introuvable." });
      res.json(results[0]);
    },
  );
});

app.put("/api/companies/:id_E", (req, res) => {
  const { nom_entreprise, adresse, secteur } = req.body;
  db.query(
    "update Entreprises set nom_entreprise = ?, adresse = ?, secteur = ? where id_E = ?",
    [nom_entreprise, adresse, secteur, req.params.id_E],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Profil entreprise mis à jour !" });
    },
  );
});

// =========================================================================
// 4. FONCTIONNALITÉS ÉTUDIANTS (Consultation & Postulation)
// =========================================================================

// Récupérer TOUTES les offres (Page d'accueil index.html avec filtre optionnel par mot-clé)
app.get("/api/all-offers", (req, res) => {
  const search = req.query.search || "";
  let query =
    "select o.*, e.nom_entreprise from Offres o join Entreprises e on o.id_E = e.id_E";
  let params = [];

  if (search !== "") {
    query += " where o.titre like ? or o.mot_cle like ?";
    params = [`%${search}%`, `%${search}%`];
  }
  query += " order by o.date_publication desc";

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Récupérer les détails d'une seule offre spécifique
app.get("/api/offers/:id_O", (req, res) => {
  db.query(
    "select o.*, e.nom_entreprise, e.adresse, e.secteur from Offres o join Entreprises e on o.id_E = e.id_E where o.id_O = ?",
    [req.params.id_O],
    (err, results) => {
      if (err || results.length === 0)
        return res.status(404).json({ error: "Offre introuvable." });
      res.json(results[0]);
    },
  );
});

// Soumettre une candidature (RG3 - Unicité gérée par l'index unique de la BDD)
app.post("/api/applications", (req, res) => {
  const { id_O, id_Et, commentaire } = req.body;
  const query =
    "insert into Candidatures (id_O, id_Et, commentaire) values (?, ?, ?)";
  db.query(query, [id_O, id_Et, commentaire], (err) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY")
        return res
          .status(400)
          .json({ error: "Vous avez déjà postulé à cette offre de stage !" });
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ message: "Votre candidature a bien été envoyée !" });
  });
});

// Suivi des candidatures d'un étudiant particulier
app.get("/api/students/:id_Et/applications", (req, res) => {
  const query =
    "select c.*, o.titre, e.nom_entreprise from Candidatures c join Offres o on c.id_O = o.id_O join Entreprises e on o.id_E = e.id_E where c.id_Et = ? order by c.date_candidature desc";
  db.query(query, [req.params.id_Et], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// =========================================================================
// 5. CONSOLE D'ADMINISTRATION (Modération)
// =========================================================================

// Statistiques globales de la plateforme
app.get("/api/admin/stats", (req, res) => {
  const qOffres = "select count(*) as total from Offres";
  const qEtudiants = "select count(*) as total from Etudiants";

  db.query(qOffres, (err, rOffres) => {
    db.query(qEtudiants, (err2, rEtudiants) => {
      if (err || err2)
        return res.status(500).json({ error: "Erreur de statistiques." });
      res.json({
        totalOffres: rOffres[0].total,
        totalEtudiants: rEtudiants[0].total,
      });
    });
  });
});

// Liste complète de tous les utilisateurs (pour admin-users.html)
app.get("/api/admin/users", (req, res) => {
  const query =
    "select id_U, email, role from Utilisateurs where role != 'Admin'";
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Bannir / Supprimer un utilisateur par l'Admin
app.delete("/api/admin/users/:id_U", (req, res) => {
  db.query(
    "delete from Utilisateurs where id_U = ?",
    [req.params.id_U],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Utilisateur banni et supprimé du système." });
    },
  );
});

// Démarrage du serveur sur le port 3000
app.listen(3000, () => {
  console.log("Serveur MyInternship lancé et prêt sur http://localhost:3000");
});
