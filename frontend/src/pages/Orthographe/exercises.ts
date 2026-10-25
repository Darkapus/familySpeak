import type { OrthoCategory } from "@familyspeak/shared";

export interface OrthoExercise {
  id: string;
  category: OrthoCategory;
  /** Phrase avec `___` à l'endroit du mot à choisir. */
  sentence: string;
  /** Mots proposés (mélangés à l'affichage). */
  options: string[];
  answer: string;
  /** Explication / astuce montrée après la réponse. */
  tip: string;
}

function make(category: OrthoCategory, prefix: string, rows: Array<[string, string[], string, string]>): OrthoExercise[] {
  return rows.map(([sentence, options, answer, tip], i) => ({
    id: `${prefix}${i + 1}`,
    category,
    sentence,
    options,
    answer,
    tip,
  }));
}

const PLURIEL = make("pluriel", "pl", [
  ["Les ___ du jardin sont fleuries.", ["fleurs", "fleur"], "fleurs", "« Les » annonce plusieurs fleurs : on ajoute un -s."],
  ["J'ai acheté trois ___ au marché.", ["melons", "melon"], "melons", "« Trois » : il y en a plusieurs, donc on ajoute -s."],
  ["Les ___ chantent dans l'arbre.", ["oiseaux", "oiseaus", "oiseau"], "oiseaux", "Les noms en -eau prennent un -x au pluriel : un oiseau, des oiseaux."],
  ["Mes ___ galopent dans le pré.", ["chevaux", "chevaus", "chevals"], "chevaux", "Les noms en -al font leur pluriel en -aux : un cheval, des chevaux."],
  ["Elle porte de jolis ___.", ["bijoux", "bijous", "bijouxs"], "bijoux", "Sept noms en -ou prennent un -x : bijou, caillou, chou, genou, hibou, joujou, pou."],
  ["Les ___ des bonbons ont augmenté.", ["prix", "prixs", "prixes"], "prix", "Les noms qui finissent déjà par -s, -x ou -z ne changent pas au pluriel."],
  ["Des fleurs ___ poussent au bord du chemin.", ["jaunes", "jaune", "jaunees"], "jaunes", "L'adjectif s'accorde avec le nom : « fleurs » est pluriel, donc « jaunes »."],
  ["Les ___ de la maison sont terminés.", ["travaux", "travails", "travaus"], "travaux", "Travail est irrégulier : un travail, des travaux."],
  ["Mes parents sont ___ de ta réussite.", ["heureux", "heureuxs", "heureus"], "heureux", "« heureux » finit déjà par -x : il ne change pas au pluriel."],
  ["Les ___ de mon vélo sont crevés.", ["pneus", "pneux", "pneu"], "pneus", "Exceptions en -eu : un pneu, des pneus (comme des bleus). Mais un cheveu, des cheveux !"],
  ["Les petites ___ jouent à la marelle.", ["filles", "fille", "fills"], "filles", "Plusieurs filles : on ajoute -s au nom."],
  ["Elle a de beaux ___ bleus.", ["yeux", "yeuxs", "yeus"], "yeux", "Pluriel irrégulier : un œil, des yeux."],
]);

const FEMININ = make("feminin", "fe", [
  ["Léa est très ___.", ["polie", "poli", "polit"], "polie", "Pour une fille, on ajoute un -e à l'adjectif : poli → polie."],
  ["Ma voisine est une femme ___.", ["gentille", "gentile", "gentil"], "gentille", "gentil → gentille : on double le l et on ajoute -e."],
  ["Mon amie est une grande ___.", ["sportive", "sportif", "sportife"], "sportive", "Les adjectifs en -if font -ive au féminin : sportif → sportive."],
  ["Sa réponse est ___.", ["fausse", "faux", "fause"], "fausse", "faux → fausse (comme roux → rousse). Mais doux → douce !"],
  ["Cette chienne est très ___.", ["mignonne", "mignone", "mignon"], "mignonne", "Les adjectifs en -on doublent souvent le n : mignon → mignonne."],
  ["Ma grand-mère est ___ ce soir.", ["fatiguée", "fatigué", "fatiguées"], "fatiguée", "Féminin singulier : on ajoute -e à fatigué → fatiguée."],
  ["Elle est ___ dans cette boulangerie.", ["boulangère", "boulanger", "boulangere"], "boulangère", "Les noms en -er font -ère au féminin : boulanger → boulangère."],
  ["Une chatte ___ dort sur le canapé.", ["blanche", "blanc", "blanque"], "blanche", "blanc → blanche : au féminin, c devient che."],
  ["La princesse est très ___.", ["belle", "bel", "beau"], "belle", "beau → belle au féminin (un beau garçon, une belle fille)."],
  ["Ma maman est ___ aujourd'hui.", ["heureuse", "heureux", "heureuze"], "heureuse", "Les adjectifs en -eux font -euse au féminin : heureux → heureuse."],
  ["Ma voisine est ___.", ["italienne", "italiene", "italien"], "italienne", "Les adjectifs en -ien doublent le n : italien → italienne."],
  ["Léa est ___ à la gym.", ["inscrite", "inscrit", "inscrits"], "inscrite", "Pour une fille : inscrit → inscrite. On entend alors le « t » !"],
]);

const VERBE = make("verbe", "ve", [
  ["Les enfants ___ dans la cour. (jouer)", ["jouent", "joue", "joues"], "jouent", "Remplace par « ils » : ils jouent. Sujet pluriel → -ent."],
  ["Le chien ___ à la porte. (aboyer)", ["aboie", "aboient", "aboies"], "aboie", "Un seul chien (il) → pas de -nt."],
  ["Tu ___ très bien. (chanter)", ["chantes", "chante", "chantent"], "chantes", "Avec « tu », le verbe finit toujours par -s (-es pour les verbes en -er)."],
  ["Mes parents ___ le journal. (lire)", ["lisent", "lit", "lis"], "lisent", "Ils lisent : sujet pluriel (ils) → -ent."],
  ["Les oiseaux ___ dans le ciel. (voler)", ["volent", "vole", "voles"], "volent", "Ils volent : plusieurs oiseaux, donc -ent."],
  ["La maîtresse ___ la leçon. (expliquer)", ["explique", "expliquent", "expliques"], "explique", "Une seule maîtresse (elle) → explique, sans -nt."],
  ["Les voisins ___ trop de bruit. (faire)", ["font", "fait", "faisent"], "font", "Attention : faire fait « ils font » (pas -ent). Même chose : ils vont, ils sont, ils ont."],
  ["Elles ___ à la piscine tous les mercredis. (aller)", ["vont", "va", "allent"], "vont", "Aller : ils/elles vont. Ce n'est pas un verbe en -er ordinaire à ce temps !"],
  ["Tu ___ toujours tes devoirs avant le dîner. (finir)", ["finis", "finit", "finissent"], "finis", "Avec « tu », on met un -s : tu finis."],
  ["Les cuisiniers ___ un gâteau. (préparer)", ["préparent", "prépare", "prépares"], "préparent", "Ils préparent : plusieurs cuisiniers → -ent."],
  ["Un groupe de garçons ___ devant l'école. (attendre)", ["attend", "attendent", "attends"], "attend", "Le sujet est « un groupe » (singulier), pas « garçons » : il attend."],
  ["Mon frère et ma sœur ___ la table. (mettre)", ["mettent", "met", "mets"], "mettent", "Deux personnes = « ils » : ils mettent."],
]);

const HOMOPHONE = make("homophone", "ho", [
  ["Les enfants ___ contents.", ["sont", "son", "ont"], "sont", "Essaie « étaient » : les enfants étaient contents → sont (verbe être)."],
  ["Elle a perdu ___ sac.", ["son", "sont", "on"], "son", "Essaie « mon » : mon sac → son (il montre à qui est le sac)."],
  ["Mes frères ___ trois chats.", ["ont", "on", "sont"], "ont", "Essaie « avaient » : ils avaient trois chats → ont (verbe avoir)."],
  ["___ va au cinéma ce soir.", ["On", "Ont", "Sont"], "On", "Essaie « il » : il va au cinéma → on."],
  ["Papa ___ maman sont partis.", ["et", "est"], "et", "Essaie « et puis » : Papa et puis maman → et. Si « était » marche, c'est est."],
  ["Mon père ___ très fort.", ["est", "et", "es"], "est", "Essaie « était » : mon père était très fort → est."],
  ["Il ___ un chien.", ["a", "à"], "a", "Essaie « avait » : il avait un chien → a (verbe avoir, sans accent)."],
  ["Nous allons ___ la piscine.", ["à", "a"], "à", "« Avait » ne marche pas ici : c'est la préposition à, avec accent."],
  ["Ils ___ mal dormi cette nuit.", ["ont", "sont", "on"], "ont", "Ils avaient mal dormi → ont (verbe avoir)."],
  ["Les élèves ___ très attentifs.", ["sont", "son", "ont"], "sont", "Les élèves étaient attentifs → sont (verbe être)."],
  ["Léa ___ partie tôt ce matin.", ["est", "et", "a"], "est", "Partir se conjugue avec être : Léa est partie."],
  ["Tu ___ en retard.", ["es", "est", "et"], "es", "Avec « tu », le verbe être fait « es »."],
]);

const PARTICIPE = make("participe", "pa", [
  ["Les filles sont ___ à l'école. (arriver)", ["arrivées", "arrivé", "arrivés"], "arrivées", "Avec être, le participe s'accorde avec le sujet : les filles → féminin pluriel."],
  ["Mon frère est ___ en retard. (arriver)", ["arrivé", "arrivée", "arrivés"], "arrivé", "Avec être : mon frère → masculin singulier, pas de e ni de s."],
  ["Elle est ___ au cinéma hier. (aller)", ["allée", "allé", "allées"], "allée", "Avec être : elle → féminin singulier, on ajoute -e."],
  ["Les garçons ont ___ au foot. (jouer)", ["joué", "joués", "jouées"], "joué", "Avec avoir, on n'accorde pas avec le sujet : ils ont joué."],
  ["J'ai mangé les pommes. Je les ai ___. (manger)", ["mangées", "mangé", "mangés"], "mangées", "Le COD « les » (= les pommes) est avant le verbe : féminin pluriel."],
  ["La tarte que maman a ___ était délicieuse. (préparer)", ["préparée", "préparé", "préparés"], "préparée", "« que » remplace la tarte (COD avant le verbe) : féminin singulier."],
  ["Léa et Emma sont ___ en vacances. (partir)", ["parties", "partis", "partie"], "parties", "Avec être : Léa et Emma → féminin pluriel."],
  ["Marie a ___ un gâteau. (acheter)", ["acheté", "achetée", "achetés"], "acheté", "Le COD « un gâteau » est après le verbe : on n'accorde pas."],
  ["Les livres que j'ai ___ sont passionnants. (lire)", ["lus", "lu", "lues"], "lus", "« que » = les livres, COD avant le verbe : masculin pluriel."],
  ["Mes cousins sont ___ hier soir. (rentrer)", ["rentrés", "rentré", "rentrées"], "rentrés", "Avec être : mes cousins → masculin pluriel."],
  ["Elles se sont ___ au parc. (promener)", ["promenées", "promené", "promenés"], "promenées", "Verbe pronominal avec être : « se » (= elles) est le COD, on accorde."],
  ["Nous avons ___ de beaux dessins. (faire)", ["fait", "faits", "faite"], "fait", "Le COD « de beaux dessins » est après le verbe : on n'accorde pas."],
]);

export const ORTHO_EXERCISES: OrthoExercise[] = [...PLURIEL, ...FEMININ, ...VERBE, ...HOMOPHONE, ...PARTICIPE];
