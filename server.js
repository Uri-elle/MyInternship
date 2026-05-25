const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const path = require("path");

const app = express();

// Middleware pour lire le JSON et les formulaires HTML
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rendre vos pages HTML/CSS accessibles publiquement
app.use(express.static(path.join(__dirname)));

// 1. Connexion à la base de données MySQL
const db = mysql.createConnection({
  host: "127.0.0.1",
  user: "root", //  utilisateur MySQL Workbench
  password: "", //  mot de passe MySQL
  database: "MyInternshipDB",
});

db.connect((err) => {
  if (err) {
    console.error("Erreur de connexion à la base de données :", err);
    return;
  }
  console.log("Connecté avec succès à la base MyInternshipDB !");
});

// 2. ROUTE : Inscription d'un Étudiant (RG1 & RG2)
app.post("/api/register-student", async (req, res) => {
  const { email, mdp, nom, prenom, formation } = req.body;

  try {
    // Hachage du mot de passe avec bcrypt comme demandé dans le cahier des charges
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(mdp, saltRounds);

    // Insertion dans la table mère Utilisateurs
    const queryUser =
      "insert into Utilisateurs (email, mdp, role) values (?, ?, 'Etudiant')";
    db.query(queryUser, [email, hashedPassword], (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(400).json({ error: "Cet email est déjà utilisé." });
        }
        return res.status(500).json({ error: err.message });
      }

      const insertedUserId = result.insertId;

      // Insertion dans la table fille Etudiants
      const queryStudent =
        "insert into Etudiants (id_U, nom, prenom, formation) values (?, ?, ?, ?)";
      db.query(
        queryStudent,
        [insertedUserId, nom, prenom, formation],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });

          res
            .status(201)
            .json({ message: "Compte étudiant créé avec succès !" });
        },
      );
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erreur lors du traitement du mot de passe." });
  }
});

// 3. ROUTE : Connexion (Authentification)
app.post("/api/login", (req, res) => {
  const { email, mdp } = req.body;

  console.log("=== TENTATIVE DE CONNEXION ===");
  console.log(
    "1. Reçu du formulaire HTML -> Email:",
    email,
    " | Mot de passe:",
    mdp,
  );

  const query = "select * from Utilisateurs where email = ?";
  db.query(query, [email], async (err, results) => {
    if (err) {
      console.error("Erreur SQL :", err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log(
        "2. Résultat SQL -> Aucun utilisateur trouvé avec l'email:",
        email,
      );
      return res.status(401).json({ error: "Identifiants incorrects." });
    }

    const user = results[0];
    console.log("2. Résultat SQL -> Utilisateur trouvé !");
    console.log("   - Rôle en BDD :", user.role);
    console.log("   - Mot de passe stocké en BDD :", user.mdp);

    // Vérification du mot de passe haché
    const match = await bcrypt.compare(mdp, user.mdp);
    console.log("3. Résultat Bcrypt -> Le mot de passe correspond-il ?", match);

    if (!match) {
      return res.status(401).json({ error: "Identifiants incorrects." });
    }

    console.log("-> CONNEXION AUTORISÉE !");
    res.json({
      message: "Connexion réussie !",
      role: user.role,
      id_U: user.id_U,
    });
  });
});

// Bloc temporaire à supprimer après un seul lancement
const testHachage = async () => {
  const hash = await bcrypt.hash("student_hash_123", 10);
  const query =
    "update Utilisateurs set mdp = ? where email = 'anamontana@yahoo.fr'";
  db.query(query, [hash], (err) => {
    if (err) console.error("Erreur de mise à jour automatique :", err);
    else
      console.log("=== RE-HACHAGE RÉUSSI AVEC SUCCÈS POUR ANA MONTANA ! ===");
  });
};

//testHachage();

// Démarrage du serveur sur le port 3000
app.listen(3000, () => {
  console.log("Serveur MyInternship lancé sur http://localhost:3000");
});
