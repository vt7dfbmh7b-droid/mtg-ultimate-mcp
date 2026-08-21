export interface ThemedSpecialPrintingV08 {
  set: string;
  collectorNumber: string;
  oracleName: string;
  label?: string;
}

export interface ThemedSpecialCoverageV08 {
  asOf: string;
  note: string;
}

// Curated against released, exactly identified physical products through 2026-08-21.
// Announced future products and hidden bonus cards whose exact identities are not yet
// verifiable are deliberately excluded until hard printing truth is available.
export const MARVEL_SPECIAL_COVERAGE_V08: ThemedSpecialCoverageV08 = {
  asOf: '2026-08-21',
  note: 'Released Marvel Secret Lair main cards, confirmed themed bonus cards, and purchase promos are curated through 2026-08-21. Announced future drops are excluded until release; unresolved hidden bonuses are not guessed.',
};

export const MIDDLE_EARTH_SPECIAL_COVERAGE_V08: ThemedSpecialCoverageV08 = {
  asOf: '2026-08-21',
  note: 'Released Middle-earth/The Hobbit Secret Lair main cards, confirmed themed bonus cards, and purchase promos are curated through 2026-08-21. The still-unresolved hidden in-pack bonuses from the August 2026 Hobbit drops are not guessed.',
};

export const MARVEL_SPECIALS_V08: ThemedSpecialPrintingV08[] = [
  // Secret Lair x Marvel Superdrop — 2024-11-04.
  { set: 'sld', collectorNumber: '1726', oracleName: 'Captain America, First Avenger', label: "Secret Lair x Marvel's Captain America" },
  { set: 'sld', collectorNumber: '1727', oracleName: "Sigarda's Aid", label: "Secret Lair x Marvel's Captain America" },
  { set: 'sld', collectorNumber: '1728', oracleName: 'Flawless Maneuver', label: "Secret Lair x Marvel's Captain America" },
  { set: 'sld', collectorNumber: '1729', oracleName: 'In the Trenches', label: "Secret Lair x Marvel's Captain America" },
  { set: 'sld', collectorNumber: '1730', oracleName: 'Sword of War and Peace', label: "Secret Lair x Marvel's Captain America" },
  { set: 'sld', collectorNumber: '1731', oracleName: 'Iron Man, Titan of Innovation', label: "Secret Lair x Marvel's Iron Man" },
  { set: 'sld', collectorNumber: '1732', oracleName: 'Galvanic Blast', label: "Secret Lair x Marvel's Iron Man" },
  { set: 'sld', collectorNumber: '1733', oracleName: "Commander's Plate", label: "Secret Lair x Marvel's Iron Man" },
  { set: 'sld', collectorNumber: '1734', oracleName: 'Sol Ring', label: "Secret Lair x Marvel's Iron Man" },
  { set: 'sld', collectorNumber: '1735', oracleName: "Inventors' Fair", label: "Secret Lair x Marvel's Iron Man" },
  { set: 'sld', collectorNumber: '1737', oracleName: 'Wolverine, Best There Is', label: "Secret Lair x Marvel's Wolverine" },
  { set: 'sld', collectorNumber: '1738', oracleName: 'Berserk', label: "Secret Lair x Marvel's Wolverine" },
  { set: 'sld', collectorNumber: '1739', oracleName: 'Rite of Passage', label: "Secret Lair x Marvel's Wolverine" },
  { set: 'sld', collectorNumber: '1740', oracleName: 'Rhythm of the Wild', label: "Secret Lair x Marvel's Wolverine" },
  { set: 'sld', collectorNumber: '1741', oracleName: 'The Ozolith', label: "Secret Lair x Marvel's Wolverine" },
  { set: 'sld', collectorNumber: '1742', oracleName: 'Storm, Force of Nature', label: "Secret Lair x Marvel's Storm" },
  { set: 'sld', collectorNumber: '1743', oracleName: 'Lightning Bolt', label: "Secret Lair x Marvel's Storm" },
  { set: 'sld', collectorNumber: '1744', oracleName: "Jeska's Will", label: "Secret Lair x Marvel's Storm" },
  { set: 'sld', collectorNumber: '1745', oracleName: 'Ice Storm', label: "Secret Lair x Marvel's Storm" },
  { set: 'sld', collectorNumber: '1746', oracleName: 'Manamorphose', label: "Secret Lair x Marvel's Storm" },
  { set: 'sld', collectorNumber: '1747', oracleName: 'Black Panther, Wakandan King', label: "Secret Lair x Marvel's Black Panther" },
  { set: 'sld', collectorNumber: '1748', oracleName: 'Secure the Wastes', label: "Secret Lair x Marvel's Black Panther" },
  { set: 'sld', collectorNumber: '1749', oracleName: 'Primal Vigor', label: "Secret Lair x Marvel's Black Panther" },
  { set: 'sld', collectorNumber: '1750', oracleName: 'Heroic Intervention', label: "Secret Lair x Marvel's Black Panther" },
  { set: 'sld', collectorNumber: '1751', oracleName: "Karn's Bastion", label: "Secret Lair x Marvel's Black Panther" },
  { set: 'sld', collectorNumber: '863', oracleName: 'Masterwork of Ingenuity', label: 'Marvel Superdrop bonus card' },
  { set: 'sld', collectorNumber: '864', oracleName: 'Sculpting Steel', label: 'Marvel Superdrop bonus card' },
  { set: 'sld', collectorNumber: '865', oracleName: 'Unnatural Growth', label: 'Marvel Superdrop bonus card' },
  { set: 'sld', collectorNumber: '866', oracleName: 'Regrowth', label: 'Marvel Superdrop bonus card' },
  { set: 'sld', collectorNumber: '867', oracleName: "Nature's Lore", label: 'Marvel Superdrop bonus card' },
  { set: 'sld', collectorNumber: '870', oracleName: 'Abundant Growth', label: 'Marvel Superdrop rare bonus card' },
  { set: 'sld', collectorNumber: '908', oracleName: 'Arcane Signet', label: "Marvel Superdrop purchase promo — Earth's Mightiest Emblem" },

  // Secret Lair x Marvel's Deadpool: April 'Pools Day — 2025-04-01.
  { set: 'sld', collectorNumber: '1753', oracleName: 'Deadpool, Trading Card', label: "Secret Lair x Marvel's Deadpool" },
  { set: 'sld', collectorNumber: '1754', oracleName: 'Deadly Rollick', label: "Secret Lair x Marvel's Deadpool" },
  { set: 'sld', collectorNumber: '1755', oracleName: 'Saw in Half', label: "Secret Lair x Marvel's Deadpool" },
  { set: 'sld', collectorNumber: '1756', oracleName: 'Blasphemous Act', label: "Secret Lair x Marvel's Deadpool" },
  { set: 'sld', collectorNumber: '1757', oracleName: 'Vandalblast', label: "Secret Lair x Marvel's Deadpool" },
  { set: 'sld', collectorNumber: '868', oracleName: 'Harmless Offering', label: "Secret Lair x Marvel's Deadpool bonus card" },
  { set: 'sld', collectorNumber: '869', oracleName: 'Blacker Lotus', label: "Secret Lair x Marvel's Deadpool rare bonus card" },

  // Secret Lair x Marvel's Spider-Man Superdrop — 2025-09-22.
  { set: 'sld', collectorNumber: '1985', oracleName: 'Deadly Dispute', label: "Marvel's Spider-Man: Villainous Plots" },
  { set: 'sld', collectorNumber: '1986', oracleName: 'Go for the Throat', label: "Marvel's Spider-Man: Villainous Plots" },
  { set: 'sld', collectorNumber: '1987', oracleName: 'Lightning Greaves', label: "Marvel's Spider-Man: Villainous Plots" },
  { set: 'sld', collectorNumber: '1988', oracleName: 'Sol Ring', label: "Marvel's Spider-Man: Villainous Plots" },
  { set: 'sld', collectorNumber: '1989', oracleName: 'Command Tower', label: "Marvel's Spider-Man: Villainous Plots" },
  { set: 'sld', collectorNumber: '1990', oracleName: 'Ephemerate', label: "Marvel's Spider-Man: Heroic Deeds" },
  { set: 'sld', collectorNumber: '1991', oracleName: 'Three Visits', label: "Marvel's Spider-Man: Heroic Deeds" },
  { set: 'sld', collectorNumber: '1992', oracleName: 'Lightning Greaves', label: "Marvel's Spider-Man: Heroic Deeds" },
  { set: 'sld', collectorNumber: '1993', oracleName: 'Sol Ring', label: "Marvel's Spider-Man: Heroic Deeds" },
  { set: 'sld', collectorNumber: '1994', oracleName: 'Command Tower', label: "Marvel's Spider-Man: Heroic Deeds" },
  { set: 'sld', collectorNumber: '1995', oracleName: 'Fact or Fiction', label: "Marvel's Spider-Man: Daily Bugle Breaking News" },
  { set: 'sld', collectorNumber: '1996', oracleName: 'Frantic Search', label: "Marvel's Spider-Man: Daily Bugle Breaking News" },
  { set: 'sld', collectorNumber: '1997', oracleName: 'Scheming Symmetry', label: "Marvel's Spider-Man: Daily Bugle Breaking News" },
  { set: 'sld', collectorNumber: '1998', oracleName: 'Blasphemous Act', label: "Marvel's Spider-Man: Daily Bugle Breaking News" },
  { set: 'sld', collectorNumber: '1999', oracleName: 'Impact Tremors', label: "Marvel's Spider-Man: Daily Bugle Breaking News" },
  { set: 'sld', collectorNumber: '1950', oracleName: 'Plains', label: "Marvel's Spider-Man: Mana Symbiote" },
  { set: 'sld', collectorNumber: '1951', oracleName: 'Island', label: "Marvel's Spider-Man: Mana Symbiote" },
  { set: 'sld', collectorNumber: '1952', oracleName: 'Swamp', label: "Marvel's Spider-Man: Mana Symbiote" },
  { set: 'sld', collectorNumber: '1953', oracleName: 'Mountain', label: "Marvel's Spider-Man: Mana Symbiote" },
  { set: 'sld', collectorNumber: '1954', oracleName: 'Forest', label: "Marvel's Spider-Man: Mana Symbiote" },
  { set: 'sld', collectorNumber: '2000', oracleName: 'Damnation', label: "Marvel's Spider-Man: Venom Unleashed (Colors)" },
  { set: 'sld', collectorNumber: '2001', oracleName: 'Dark Ritual', label: "Marvel's Spider-Man: Venom Unleashed (Colors)" },
  { set: 'sld', collectorNumber: '2002', oracleName: 'Peer into the Abyss', label: "Marvel's Spider-Man: Venom Unleashed (Colors)" },
  { set: 'sld', collectorNumber: '2003', oracleName: 'Surgical Extraction', label: "Marvel's Spider-Man: Venom Unleashed (Colors)" },
  { set: 'sld', collectorNumber: '2004', oracleName: 'Tendrils of Agony', label: "Marvel's Spider-Man: Venom Unleashed (Colors)" },
  { set: 'sld', collectorNumber: '2019', oracleName: 'Damnation', label: "Marvel's Spider-Man: Venom Unleashed (Inks)" },
  { set: 'sld', collectorNumber: '2020', oracleName: 'Dark Ritual', label: "Marvel's Spider-Man: Venom Unleashed (Inks)" },
  { set: 'sld', collectorNumber: '2021', oracleName: 'Peer into the Abyss', label: "Marvel's Spider-Man: Venom Unleashed (Inks)" },
  { set: 'sld', collectorNumber: '2022', oracleName: 'Surgical Extraction', label: "Marvel's Spider-Man: Venom Unleashed (Inks)" },
  { set: 'sld', collectorNumber: '2023', oracleName: 'Tendrils of Agony', label: "Marvel's Spider-Man: Venom Unleashed (Inks)" },
  { set: 'sld', collectorNumber: '7013', oracleName: 'Brainstorm', label: "Marvel's Spider-Man bonus card — sketch" },
  { set: 'sld', collectorNumber: '7014', oracleName: 'Fatal Push', label: "Marvel's Spider-Man bonus card — sketch" },
  { set: 'sld', collectorNumber: '7015', oracleName: 'Harmonize', label: "Marvel's Spider-Man bonus card — sketch" },
  { set: 'sld', collectorNumber: '7016', oracleName: 'Brainstorm', label: "Marvel's Spider-Man bonus card — ink" },
  { set: 'sld', collectorNumber: '7017', oracleName: 'Fatal Push', label: "Marvel's Spider-Man bonus card — ink" },
  { set: 'sld', collectorNumber: '7018', oracleName: 'Harmonize', label: "Marvel's Spider-Man bonus card — ink" },
  { set: 'sld', collectorNumber: '7019', oracleName: 'Brainstorm', label: "Marvel's Spider-Man bonus card — color" },
  { set: 'sld', collectorNumber: '7020', oracleName: 'Fatal Push', label: "Marvel's Spider-Man bonus card — color" },
  { set: 'sld', collectorNumber: '7021', oracleName: 'Harmonize', label: "Marvel's Spider-Man bonus card — color" },

  // Marvel's Deadpool: I Fixed It (You're Welcome) — 2026-04-01.
  { set: 'sld', collectorNumber: 'IFIYW-1', oracleName: 'Deadly Dispute', label: "Marvel's Deadpool: I Fixed It (You're Welcome)" },
  { set: 'sld', collectorNumber: 'IFIYW-2', oracleName: 'Lightning Bolt', label: "Marvel's Deadpool: I Fixed It (You're Welcome)" },
  { set: 'sld', collectorNumber: 'IFIYW-3', oracleName: 'Thrill of Possibility', label: "Marvel's Deadpool: I Fixed It (You're Welcome)" },
  { set: 'sld', collectorNumber: 'IFIYW-4', oracleName: 'Lightning Greaves', label: "Marvel's Deadpool: I Fixed It (You're Welcome)" },
  { set: 'sld', collectorNumber: 'IFIYW-5', oracleName: 'Sol Ring', label: "Marvel's Deadpool: I Fixed It (You're Welcome)" },
  { set: 'sld', collectorNumber: 'IFIYW-6', oracleName: 'Deadly Dispute', label: "Marvel's Deadpool: I Fixed It (You're Welcome) — Pool Party" },
  { set: 'sld', collectorNumber: 'IFIYW-7', oracleName: 'Lightning Bolt', label: "Marvel's Deadpool: I Fixed It (You're Welcome) — Pool Party" },
  { set: 'sld', collectorNumber: 'IFIYW-8', oracleName: 'Thrill of Possibility', label: "Marvel's Deadpool: I Fixed It (You're Welcome) — Pool Party" },
  { set: 'sld', collectorNumber: 'IFIYW-9', oracleName: 'Lightning Greaves', label: "Marvel's Deadpool: I Fixed It (You're Welcome) — Pool Party" },
  { set: 'sld', collectorNumber: 'IFIYW-10', oracleName: 'Sol Ring', label: "Marvel's Deadpool: I Fixed It (You're Welcome) — Pool Party" },
  { set: 'sld', collectorNumber: '7126', oracleName: 'Mountain', label: "Marvel's Deadpool: I Fixed It (You're Welcome) bonus card" },
  { set: 'sld', collectorNumber: '7127', oracleName: 'Deadpool, Trading Card', label: "Marvel's Deadpool: I Fixed It (You're Welcome) bonus card" },
  { set: 'sld', collectorNumber: '7128', oracleName: 'Mountain', label: "Marvel's Deadpool: I Fixed It (You're Welcome) Pool Party bonus card" },
  { set: 'sld', collectorNumber: '7129', oracleName: 'Deadpool, Trading Card', label: "Marvel's Deadpool: I Fixed It (You're Welcome) Pool Party bonus card" },

  // Secret Lair x Marvel: Spinner Rack Specials — 2026-07-17.
  { set: 'sld', collectorNumber: '2622', oracleName: 'Hammerhead, Maggia Boss', label: 'Secret Lair x Marvel: Spinner Rack Specials' },
  { set: 'sld', collectorNumber: '2623', oracleName: 'Undead Hand Ninja', label: 'Secret Lair x Marvel: Spinner Rack Specials' },
  { set: 'sld', collectorNumber: '2624', oracleName: 'Hex Magic', label: 'Secret Lair x Marvel: Spinner Rack Specials' },
  { set: 'sld', collectorNumber: '2625', oracleName: 'Tippy-Toe, Terrific Partner', label: 'Secret Lair x Marvel: Spinner Rack Specials' },
  { set: 'sld', collectorNumber: '2626', oracleName: 'Baxter Building', label: 'Secret Lair x Marvel: Spinner Rack Specials' },
  { set: 'sld', collectorNumber: '7117', oracleName: 'Counterspell', label: 'Marvel Spinner Rack bonus card — sketch' },
  { set: 'sld', collectorNumber: '7118', oracleName: 'Fabricate', label: 'Marvel Spinner Rack bonus card — sketch' },
  { set: 'sld', collectorNumber: '7119', oracleName: 'Ponder', label: 'Marvel Spinner Rack bonus card — sketch' },
  { set: 'sld', collectorNumber: '7120', oracleName: 'Counterspell', label: 'Marvel Spinner Rack bonus card — ink' },
  { set: 'sld', collectorNumber: '7121', oracleName: 'Fabricate', label: 'Marvel Spinner Rack bonus card — ink' },
  { set: 'sld', collectorNumber: '7122', oracleName: 'Ponder', label: 'Marvel Spinner Rack bonus card — ink' },
  { set: 'sld', collectorNumber: '7123', oracleName: 'Counterspell', label: 'Marvel Spinner Rack bonus card — color' },
  { set: 'sld', collectorNumber: '7124', oracleName: 'Fabricate', label: 'Marvel Spinner Rack bonus card — color' },
  { set: 'sld', collectorNumber: '7125', oracleName: 'Ponder', label: 'Marvel Spinner Rack bonus card — color' },
];

export const MIDDLE_EARTH_SPECIALS_V08: ThemedSpecialPrintingV08[] = [
  // More Adventures in Middle-earth — 2023-08-29.
  { set: 'sld', collectorNumber: '1293', oracleName: 'Slip On the Ring', label: 'More Adventures in Middle-earth' },
  { set: 'sld', collectorNumber: '1294', oracleName: 'Gandalf, Friend of the Shire', label: 'More Adventures in Middle-earth' },
  { set: 'sld', collectorNumber: '1295', oracleName: 'Mirror of Galadriel', label: 'More Adventures in Middle-earth' },
  { set: 'sld', collectorNumber: '1296', oracleName: 'Shire Terrace', label: 'More Adventures in Middle-earth' },
  { set: 'sld', collectorNumber: '734', oracleName: 'Gríma Wormtongue', label: 'More Adventures in Middle-earth bonus card' },

  // Secret Lair x The Hobbit: A Marvelous Mathoms Superdrop — 2026-08-17.
  { set: 'sld', collectorNumber: '2552', oracleName: 'Cloudshift', label: 'Secret Lair x The Hobbit: Over the Edge of the Wild' },
  { set: 'sld', collectorNumber: '2553', oracleName: "Tocasia's Welcome", label: 'Secret Lair x The Hobbit: Over the Edge of the Wild' },
  { set: 'sld', collectorNumber: '2554', oracleName: 'Stony Silence', label: 'Secret Lair x The Hobbit: Over the Edge of the Wild' },
  { set: 'sld', collectorNumber: '2555', oracleName: "Imp's Mischief", label: 'Secret Lair x The Hobbit: Over the Edge of the Wild' },
  { set: 'sld', collectorNumber: '2556', oracleName: 'Seize the Spoils', label: 'Secret Lair x The Hobbit: Over the Edge of the Wild' },
  { set: 'sld', collectorNumber: '2557', oracleName: 'Fellwar Stone', label: "Secret Lair x The Hobbit: Smaug's Spoils" },
  { set: 'sld', collectorNumber: '2558', oracleName: 'Lightning Greaves', label: "Secret Lair x The Hobbit: Smaug's Spoils" },
  { set: 'sld', collectorNumber: '2559', oracleName: 'Liquimetal Torque', label: "Secret Lair x The Hobbit: Smaug's Spoils" },
  { set: 'sld', collectorNumber: '2560', oracleName: 'Sol Ring', label: "Secret Lair x The Hobbit: Smaug's Spoils" },
  { set: 'sld', collectorNumber: '2561', oracleName: 'Thought Vessel', label: "Secret Lair x The Hobbit: Smaug's Spoils" },
  { set: 'sld', collectorNumber: '2562', oracleName: 'Defile', label: 'Secret Lair x The Hobbit: Desolation' },
  { set: 'sld', collectorNumber: '2563', oracleName: 'Diabolic Intent', label: 'Secret Lair x The Hobbit: Desolation' },
  { set: 'sld', collectorNumber: '2564', oracleName: 'Dread Return', label: 'Secret Lair x The Hobbit: Desolation' },
  { set: 'sld', collectorNumber: '2565', oracleName: 'Mirkwood Bats', label: 'Secret Lair x The Hobbit: Desolation' },
  { set: 'sld', collectorNumber: '2566', oracleName: 'Read the Bones', label: 'Secret Lair x The Hobbit: Desolation' },
  { set: 'sld', collectorNumber: '2567', oracleName: 'Arcane Heist', label: 'Secret Lair x The Hobbit: He Who Walks Unseen' },
  { set: 'sld', collectorNumber: '2568', oracleName: 'Contentious Plan', label: 'Secret Lair x The Hobbit: He Who Walks Unseen' },
  { set: 'sld', collectorNumber: '2569', oracleName: 'Curiosity', label: 'Secret Lair x The Hobbit: He Who Walks Unseen' },
  { set: 'sld', collectorNumber: '2570', oracleName: 'Solve the Equation', label: 'Secret Lair x The Hobbit: He Who Walks Unseen' },
  { set: 'sld', collectorNumber: '2571', oracleName: 'Windfall', label: 'Secret Lair x The Hobbit: He Who Walks Unseen' },
  { set: 'sld', collectorNumber: '916', oracleName: 'Arcane Signet', label: 'The Hobbit Superdrop purchase promo — Heart of the Mountain' },
];
