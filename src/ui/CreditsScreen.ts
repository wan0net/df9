import { SoundManager } from '../audio/SoundManager';
import { playWarbleFullscreen } from './WarbleEffect';

const AMBER = '#dfa200';

// Lua Credits.lua: SCROLL_DELAY=5, SCROLL_AMOUNT=-15000, SCROLL_TIME=125s, SCROLL_START_Y=-900
const SCROLL_SPEED = 120; // px/s (Lua: -SCROLL_AMOUNT / SCROLL_TIME = 15000/125 = 120)
const SCROLL_DELAY = 5; // seconds before scrolling starts

interface CreditSection {
  title: string;
  entries: { role: string; name: string }[] | string[];
}

// All data extracted from CreditsLayout.lua
const SECTIONS: CreditSection[] = [
  {
    title: 'Derelict Games Team v1.09',
    entries: [
      { role: 'Project Lead / Lead Programmer', name: 'Rick Jones ("Skenners")' },
      { role: 'Art Contributions From:', name: 'Jeff Morice ("Reversetrio")' },
      { role: 'With Thanks To:', name: 'Steam Forum Peeps and You. Thank You for keeping me going!' },
    ],
  },
  {
    title: 'Spacebase Restoration Squad Team v1.08',
    entries: [
      { role: 'Project Lead', name: 'Rick Jones ("Skenners")' },
      { role: 'Primary Art Director', name: 'Edwin Wiersma ("Edwiersma")' },
      { role: 'Secondary Art Director', name: 'Gregory Benzschawel ("radian2pi")' },
      { role: 'Derelict Games Team:', name: 'Andrew Hewson ("decoy")' },
      { role: '', name: 'Cody Claborn ("cxsquared")' },
      { role: '', name: 'Bryce Harrington ("BryceHarrington")' },
      { role: '', name: 'Michael Hamm ("UntrustedLife")' },
      { role: '', name: 'Jack Jones ("jaywjay03")' },
      { role: 'Team Awesome (SBRS):', name: 'Henk van der Laan ("henkvdlaan")' },
      { role: '', name: 'Mike D ("bigmikeit")' },
      { role: '', name: 'SpiritWolfie ("Spirit")' },
      { role: '', name: 'Pavan Rikhi ("lysergia")' },
      { role: 'With Thanks To:', name: 'Dan Mattingley ("McJim")' },
      { role: '', name: 'Christopher Limb ("kathis")' },
      { role: '', name: 'Callum Colburn ("gh057")' },
      { role: '', name: 'Matt Flagg ("MFlagg")' },
      { role: 'Previous Mod Makers:', name: 'Cridge (Steam) - "Sandbox Mode" Code' },
      { role: '', name: 'Team DoubleSpank (Steam) - "Delay of Annoyance v02c" Code' },
      { role: '', name: 'RobRendell (DF Forums) - All his mods' },
    ],
  },
  {
    title: 'Original Spacebase Team',
    entries: [
      { role: 'Project Lead', name: 'JP LeBreton' },
      { role: 'Senior Producer', name: 'Gabe Miller' },
      { role: 'Lead Programmer', name: 'Matt Franklin' },
      { role: 'Lead Artist', name: 'Jeremy Mitchell' },
      { role: 'Graphics Programmer', name: 'Ben Burbank' },
      { role: 'Programming', name: 'Kee Chi' },
      { role: '', name: 'Patrick Connor' },
      { role: '', name: 'Nathan Martz' },
      { role: '', name: 'Ben Peck' },
      { role: 'Character Modeler', name: 'Jeremy Natividad' },
      { role: 'Interface Design', name: 'Jake Rodkin' },
      { role: 'Animators', name: 'Elliott Roberts' },
      { role: '', name: 'Ray Crook' },
      { role: '', name: 'Chris Lam' },
      { role: 'Materials', name: 'Kristen Russell' },
      { role: 'Additional Art', name: 'Derek Brand' },
      { role: '', name: 'Razmig Mavlian' },
      { role: '', name: 'Geoff Soulis' },
      { role: '', name: 'Frederik Storm' },
      { role: 'Sound Designers', name: 'Brian Correia' },
      { role: '', name: 'Camden Stoddard' },
      { role: 'Music', name: 'Chris Remo' },
      { role: 'Lead Tester', name: 'Tony Lo' },
    ],
  },
  {
    title: 'Double Fine Productions',
    entries: [
      { role: 'CEO and Studio Creative Director', name: 'Tim Schafer' },
      { role: 'COO', name: 'Justin Bailey' },
      { role: 'VP of Development', name: 'Isa Anne Stamos' },
      { role: 'Audio Director', name: 'Brian Min' },
      { role: 'Senior Publishing Manager', name: 'Greg Rice' },
      { role: 'Web Development', name: 'Chris Remo' },
      { role: 'QA Manager', name: 'Daniel Pangelina' },
      { role: 'Tech Ops Manager', name: 'Aaron Hayes' },
      { role: 'Desktop Technician', name: 'Justin Honegger' },
      { role: 'Studio Tech', name: 'Adrian Melian' },
      { role: '', name: 'Anna Kipnis' },
      { role: '', name: 'Brandon Dillon' },
      { role: '', name: 'Oliver Franzke' },
      { role: '', name: 'Paul Du Bois' },
    ],
  },
  {
    title: 'Indie Fund',
    entries: [
      'Indie Fund', 'Humble Bundle', 'Hemisphere Games', 'make all LLC',
      'AppAbove Games', 'Adam and Rebekah Saltsman', 'The Behemoth',
      'Morgan Webb', 'Rob Reid',
    ],
  },
  {
    title: 'Special Thanks',
    entries: [
      'Mom, Dad, and Elise', 'Katrina Tilds & Truman',
      'Ruth, Violet, and Valencia', 'Jess, Jho, Margot and Jack Fields',
      'Amanda, Lana, Oliver', 'Mighty', 'Kayla Stead', 'Nick Breckon',
      'Keri, Tia (Cake), Terra (Kicks) Bailey, and Jack C. Bailey',
    ],
  },
  {
    title: 'Additional Thanks',
    entries: [
      'bobsayshilol', 'Dingobloo', 'Zak McClendon', 'Coldrice',
      'Tynan Sylvester', 'Ray Yetka', 'Tynan Wales', "Jason O'Connell",
      'Jack Fields', 'Kent Hudson', 'Aubrey Hesselgren', 'Rich Wilson',
      'David Pittman', 'Scott LaGrasta', 'L Stiger', 'Will Armstrong',
      'twoflower', 'Korbei83', 'postfish', 'MichaelM', 'clydebink',
      'pianobadger', 'dvdhaus', 'Robon', 'liorean', 'Acorino', 'nulian',
      'SirDregan', 'DaveKap', 'AlexCovic', 'SlothOnFire', 'spacebug',
      'marcus', 'centax',
    ],
  },
  {
    title: 'Citizens',
    entries: [
      'Juuso Haimilahti', 'Mark Kalinic', 'Stefan Gagne', 'Rox_Out',
      'Brendan Sinclair', 'ZOP', 'Finis Kalan', 'Cheeseness', 'Jes Golka',
      'Jeffrey Rosen', 'Vicente Emmanuel Toppington', "Frank 'Aetheria' Wentink",
      'Dustin Noah Brady', 'James Feister', 'Will Hudson', 'TLM3101',
      'Ross "TorpedoBeetle" Dexter', 'Joao Carlos Bastos', 'Harrison G. Pink',
      'Steve Gaynor', 'Richard Porczak', 'Torbjorn Gronnevik Dahle',
      'Ortwyn Regal', 'Sghoul', 'Nicholas "Mongo" Malfatti', 'Matthew Waegelin',
      'Benjamin Kantor', 'Peter Silk', "Michiel 'elmuerte' Hendriks",
      'Markus Bachler', 'Patrick Kirkner', 'Steve Stone', 'Colin Marc',
      'Julian Schmid', 'Claire Blackshaw', 'Edmond Tran', 'Dave Kellaway',
      'Dinnerbone', 'Jim Fasoline', 'Adam Heslop', 'Donato "ricin" Sinicco, III',
      'Brock Wilbur', 'Andrew (Kayrack) Chapman', 'Corey Van Meekeren',
      'Mikhail Popov', 'Craig Alexander Dolan', 'Michael Klamerus',
      'Dominique Dubois', 'Brian Krenrich', 'Noel Nacion', 'Timothy M. Lewis',
      'Paul Mach', 'Sam Courtney', 'Malek Annabi', 'Matthew Jacques',
      'Matthew Blaine Smith', 'Jon Caldwell', 'Fang-Kai Hsieh',
      'Jason Christensen', 'Mike Weldon', 'Angelo "Peps" Pepe',
      'Matthew S. Turvey', 'Doug Tabacco', 'Dimitri Roche', 'Heidi Hokka',
      'Ryan Corathers', 'Zhang JingQI', 'Tom Grundy',
      'Yegor Myronenko a.k.a. YogiTheWise', 'Jesse Clark', 'Matthew Casebeer',
      'Joseph M Bascetta', 'Casey Young', 'Nicholas Wogberg', 'Jenn Sandercock',
      'Luke Jennings', 'Lovisa Hansen', 'Charlie Hoyt', 'Brenton D I Dick',
      'Justin "NeoWulf" Smith', 'Jonathon Bowyer', 'Bryce Whitty',
      'Arne Roomann-Kurrik', 'Brian Haucke', 'Lennart Kessler', 'James Mitchell',
      'Maarten Degenhart', 'Wolfram Riedel', 'zer0her0', 'Andreas Sammer',
      'Duane Bekaert', 'Glenn', 'Max Zettlmeissl', 'Nicholas Paul Finuf',
      'Kel Cecil', 'Johan Hansen', 'Ryan Tornell', 'Maik Erhard', 'Joe Shipley',
      'Solemklanen', 'Terry Walker', 'Peter Leyshan', 'Frantisek Bauer',
      'Izzdin Tan', 'Michael Beemer', 'Karsing Fung', 'Austin Coccia',
      'Steve Tranby', 'Charles Banas', 'Nick Orlowski', 'Gary Marshall',
      'Michele Colombo', 'Alain Labranche', 'Wesley Ng-A-Fook', 'Colum Linnane',
      'Brodman', 'Adam Kamrad', 'Richard Symons aka Udders',
      '"Copesetic" Matt Kaplan', 'J Hammarstrom', 'Richard Kyte',
      'Joshua W Reeves', 'Massimo Crea', 'Axel Baxarias Fontaine',
      'Dennis Hillmann', 'Mycroft Geek', 'Ben Jackson', 'LC NOoSE IV',
      'Thomas Dollahon', 'Robert Campbell', 'Jeremy Minx', 'Gemini Wong',
      'Dead Videos', 'Connor Richman', 'Eduardo Reyes Alvarez (Lalo)',
      'Charlie Nordlund', 'Nicholas Bomford', 'Randy Flagg',
      'Peri (Arunion) Holm', 'Lachlan Cooper', 'Ashley White',
      'Steve Etherington', 'Gabriel Psarros', 'Chris Blackmore',
      'Dominick Allen', 'JohnHeroHD', 'Dominik Johann', 'Lann Cowman',
      'Carlos M Gomez', 'Stefan Correa', 'Bob-Colin Balkenhol', 'Kati Graham',
      'Tory Netherton', 'Andrew Dennison', 'Jay Furman', 'Patrix Devitt',
      'Florian Hirt (Spelaea)', 'Luca Frigerio', 'Byron Lunau',
      'Fierre Mallow', 'Sunit Das', 'Dan P', 'Nate "Obs" Smalley',
      'Adrian Eccles', 'James A York', 'John Cruickshanks', 'Ian Corcoran',
      'Alexander A. Young', 'Todd Kolbuck', 'Matthias Grunwald',
      'Nikita Samoylov', 'J.A. Dalley', 'Paul Jickling', 'Florian Maunier',
      'Daniel Harmsworth', 'Heiko Muller', 'Johan "Skork" Bjork',
      'Jeff "Golg0than" Jankowski', 'Brandon Traffanstedt', 'Caleb McCarty',
      'Jesse Coppel', 'Kai Weutzing', 'J.D. Cohen', 'Lisa Shearman',
      'Norleif Slettebo', 'Tommy Kjaer Mikkelsen', 'Sascha Lipiec',
      'William Brockie', 'Alexander Simmons', 'Joseph Milazzo', 'Steve Wilman',
      'Piotr Michalczyk', 'Mecheil Shiflett', 'Michael Glen Fuller Jr', 'usoda',
      'Jeremy Moody', 'Timothy Allen Gray', 'Tom "Remirol" Lorimer',
      'Isaac Blum', 'Jeff Tarpy', 'Andy Causon', 'Dennis S. H.',
      'David "DHeth" Heth', 'Thomas Adam Madigan', 'Christopher Hartley Fratz',
      'Jacques MIchelet', 'Bleualtoids', 'Caro Ilott', 'Nathan Lubinski',
      'Andrew "Ace" Campbell', 'Derek Gore', 'Shawnee Camu Altmann',
      'Cameron Tingley (ultrapwner45)', 'Whittle', 'Sean Pelkey',
      'Nathan Taylor', 'SZPYTMA Cyril', 'David L. Heth', 'Maximilian Marx',
      'Sebastian Bieler', 'Bastian Meissner', 'Patrick Vohrs', 'Volker Andres',
      'Seth Brush', 'Axel Woermann', 'Lars -harlequin- Meyer', 'Stefan Weber',
      'Leon Roman Schindler', "Sascha 'Drakon Drakunov' Muller",
      'Carl "Carlius" Gillblad', 'Michael', 'Brian Levinsen', 'Roland Veen',
      'Jason Scrivens', "TV's Adam Taliercio", 'Pawel Kolek',
      'Trent Petronaitis', 'Marcel (matzsystem) Matz', 'Jarred Brown',
      'Steph Gibbs', 'Lukas Sarnowski', 'Larry Hong', 'Nick Pitino',
      'Alex Dunlevie', 'Timothy Bridges', 'Koen De Couck', 'spynet1966',
      'Aidan Coxon', 'Gatewayy', 'Jarred Leverton',
      'Stefan "Prince Metal" Weber', 'Chase Miles', 'Michael D. Hoyle',
      'Eric Amsler', 'Jeremy Blake', 'Undead.Potato', 'Justin Ouellette',
      'Matthew Daly', 'Engin Unsal', "Tim 'Bales' Bridges", 'Chris Klugewicz',
      'Scott Wood', "Phillip 'Palnai' Kinsella", 'Michael Brewer',
      'Travis Q Goodwin', 'PanMocny', 'Reptarella',
      'X Myth aka Mark Saunders', 'Kris Lantzy',
      'Frank "The Tank" Messier', 'Albert G.',
      'Krister "Probeus" Berntsen', 'YamiCaleb SoulSlayer', 'L. Long',
      'David Elton', 'Jose Biosca Martin', 'Steve Gauthier', 'Matt Falzone',
      'Scott Stevenson', 'Michael J. Rice', 'Mr. J.P. Drum', 'Andrew Simpson',
      'Tyler Rielly', 'Riaan Jonker', 'Brumley Daniel Pritchett, Jr',
      'Daniel "Curumim" Cruz Lopez', 'Steve Olic', 'Atahan', 'Dave Mongoose',
      'Thomas Wyndham', 'Sunit Das', 'John McDaris', 'Heather Quinnell',
      'Robert A Vick, V', 'BrainlessKing', 'Pascal (Sev) Vogler',
      'Tyler Cooke', 'Christopher Grimm', 'Michael Barrell', 'Logan Mac',
      'Alexis Levan', "Timothy 'Bales' Bridges", 'Mimness',
      'Gyorgy Somorjai', 'Malcolm J. MacDonald', 'alexthekok', 'GOODYBOY',
      'Lewis Emmas', 'Will Woods', 'Michael Harris', 'Dave Sherman',
      'Daniel JW Ellis', 'Jennifer McMurray', 'Andreas Sjursen', 'Joey Fowler',
      'Trevor Cobbett',
    ],
  },
  {
    title: 'Spacebase DF-9 Open Source Team',
    entries: [
      'JP LeBreton', 'Matt Franklin', 'Anna Kipnis', 'Joe Kowalski',
      'Nathan Martz', 'Jeremy Mitchell', 'Say Oh', 'Chris Remo',
      'Nathan Stapley',
    ],
  },
];

export class CreditsScreen {
  private overlay: HTMLDivElement | null = null;
  private scrollContainer: HTMLDivElement | null = null;
  private animFrame = 0;
  private scrollY = 0;
  private startTime = 0;
  private onClose: (() => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickCount = 0;

  show(container: HTMLElement, onClose: () => void) {
    this.onClose = onClose;
    this.clickCount = 0;

    this.overlay = document.createElement('div');
    this.overlay.id = 'credits-screen';
    this.overlay.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.83);z-index:150;overflow:hidden;
      cursor:pointer;
    `;

    // Scroll container with all credit sections
    this.scrollContainer = document.createElement('div');
    this.scrollContainer.style.cssText = `
      position:absolute;left:50%;transform:translateX(-50%);
      width:900px;top:0;
      font-family:'Dosis',sans-serif;
    `;

    // Build all sections
    let yOffset = window.innerHeight; // Start below viewport (Lua SCROLL_START_Y = -900 from center)
    for (const section of SECTIONS) {
      // Section header
      const header = document.createElement('div');
      header.textContent = section.title;
      header.style.cssText = `
        color:${AMBER};font-family:'Orbitron',monospace;font-size:28px;
        text-align:center;margin-top:80px;margin-bottom:20px;
        font-weight:600;
      `;
      this.scrollContainer.appendChild(header);

      // Entries
      if (section.entries.length > 0 && typeof section.entries[0] === 'string') {
        // Simple name list (centered)
        for (const name of section.entries as string[]) {
          const line = document.createElement('div');
          line.textContent = name;
          line.style.cssText = `
            color:#fff;font-size:20px;text-align:center;
            line-height:32px;
          `;
          this.scrollContainer.appendChild(line);
        }
      } else {
        // Role-name pairs (two columns)
        const grid = document.createElement('div');
        grid.style.cssText = `
          display:grid;grid-template-columns:1fr 1fr;gap:0 20px;
          max-width:850px;margin:0 auto;
        `;
        for (const entry of section.entries as { role: string; name: string }[]) {
          const roleEl = document.createElement('div');
          roleEl.textContent = entry.role;
          roleEl.style.cssText = `
            color:#aaa;font-size:18px;text-align:right;
            line-height:32px;
          `;
          grid.appendChild(roleEl);

          const nameEl = document.createElement('div');
          nameEl.textContent = entry.name;
          nameEl.style.cssText = `
            color:#fff;font-size:18px;text-align:left;
            line-height:32px;
          `;
          grid.appendChild(nameEl);
        }
        this.scrollContainer.appendChild(grid);
      }
    }

    // Footer spacer
    const spacer = document.createElement('div');
    spacer.style.cssText = `height:${window.innerHeight}px;`;
    this.scrollContainer.appendChild(spacer);

    // Footer text
    const footer = document.createElement('div');
    footer.textContent = 'Click or press ESC to return';
    footer.style.cssText = `
      text-align:center;color:#666;font-size:14px;
      font-family:'Orbitron',monospace;padding-bottom:40px;
    `;
    this.scrollContainer.appendChild(footer);

    this.overlay.appendChild(this.scrollContainer);
    container.appendChild(this.overlay);
    playWarbleFullscreen(this.overlay, 0.3, 0.3);

    // Click to close (Lua: first click sets bGotUpClick, second click closes)
    this.overlay.addEventListener('click', () => {
      if (this.clickCount > 0) {
        this.hide();
      } else {
        this.clickCount++;
      }
    });

    // ESC to close
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    // Start scrolling after delay
    this.scrollY = 0;
    this.startTime = performance.now();
    this.animate();
  }

  private animate = () => {
    if (!this.scrollContainer) return;
    const elapsed = (performance.now() - this.startTime) / 1000;
    if (elapsed > SCROLL_DELAY) {
      this.scrollY = (elapsed - SCROLL_DELAY) * SCROLL_SPEED;
    }
    this.scrollContainer.style.top = `${-this.scrollY}px`;
    this.animFrame = requestAnimationFrame(this.animate);
  };

  hide() {
    cancelAnimationFrame(this.animFrame);
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    this.overlay?.remove();
    this.overlay = null;
    this.scrollContainer = null;
    SoundManager.playUI('Intro_CancelButton');
    this.onClose?.();
  }

  isVisible() {
    return this.overlay !== null;
  }
}
