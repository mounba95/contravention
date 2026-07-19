const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
const db = require("./store");
const { normaliserPlaque } = require("../middleware/validators");

async function seed() {
  if ((await db.users.count()) === 0) {
    await db.users.insert({
      id: uuid(),
      username: "admin",
      password_hash: bcrypt.hashSync("admin123", 8),
      role: "admin",
      nom: "Administrateur Système",
      station: "Direction Générale"
    });
    await db.users.insert({
      id: uuid(),
      username: "agent007",
      password_hash: bcrypt.hashSync("agent123", 8),
      role: "agent",
      nom: "Moussa Ibrahim",
      matricule: "PN-2024-0451",
      station: "Commissariat Central Niamey"
    });
    console.log("Utilisateurs créés : admin/admin123, agent007/agent123");
  }

  if ((await db.citoyens.count()) === 0) {
    const citoyensDemo = [
      { niu: "NIU-100234567", nom: "Souley", prenom: "Aïcha", date_naissance: "1990-04-12", telephone: "+22790001122" },
      { niu: "NIU-100234568", nom: "Idrissa", prenom: "Boubacar", date_naissance: "1985-11-03", telephone: "+22796002233" },
      { niu: "NIU-100234569", nom: "Chaibou", prenom: "Fatima", date_naissance: "1998-07-22", telephone: "+22791003344" }
    ];
    for (const c of citoyensDemo) await db.citoyens.insert(c);
    console.log("Citoyens (RNP simulé) créés : " + citoyensDemo.map(c => c.niu).join(", "));
  }

  if ((await db.vehicules.count()) === 0) {
    // Registre des véhicules simulé : chaque plaque est reliée au NIU d'un
    // citoyen ci-dessus. L'agent saisit la plaque, le système en déduit le
    // propriétaire puis son téléphone (via le RNP) pour le SMS de paiement.
    const vehiculesDemo = [
      { plaque: "1A 2345 RN", niu: "NIU-100234567", marque: "Toyota", modele: "Corolla", couleur: "Blanc" },
      { plaque: "5J 6789 RN", niu: "NIU-100234568", marque: "Peugeot", modele: "206", couleur: "Gris" },
      { plaque: "2M 1122 RN", niu: "NIU-100234569", marque: "Yamaha", modele: "YBR (moto)", couleur: "Rouge" }
    ];
    for (const v of vehiculesDemo) await db.vehicules.insert({ ...v, plaque: normaliserPlaque(v.plaque) });
    console.log("Véhicules (registre simulé) créés : " + vehiculesDemo.map(v => v.plaque).join(", "));
  }

  if ((await db.typesInfraction.count()) === 0) {
    const types = [
      { id: uuid(), libelle: "Excès de vitesse", montant: 15000 },
      { id: uuid(), libelle: "Non-port de la ceinture de sécurité", montant: 5000 },
      { id: uuid(), libelle: "Téléphone au volant", montant: 10000 },
      { id: uuid(), libelle: "Défaut de casque (moto)", montant: 5000 },
      { id: uuid(), libelle: "Stationnement interdit", montant: 3000 },
      { id: uuid(), libelle: "Feu rouge grillé", montant: 20000 },
      { id: uuid(), libelle: "Absence de contrôle technique", montant: 12000 },
      { id: uuid(), libelle: "Défaut d'assurance", montant: 25000 }
    ];
    for (const t of types) await db.typesInfraction.insert(t);
    console.log("Types d'infraction créés : " + types.length);
  }
}

module.exports = seed;
