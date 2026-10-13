// FlowTV sample catalog (Wizard-of-Oz data).
// This file stands in for the future AI system's knowledge: what is on each
// streaming service the room subscribes to, what is on local cable, and where
// well-known scenes fall inside a title. Availability, channel numbers and
// scene timestamps are illustrative sample data, not real listings.

window.FLOW_CATALOG = [
  {
    id: "titanic", title: "Titanic", year: 1997, kind: "Movie", runtime: "3:14:00",
    source: "streaming", service: "Prime Video", colors: ["#2A5878", "#07131D"],
    keys: { "titanic": 8, "ship": 2, "boat": 2, "sinks": 3, "sinking": 3, "iceberg": 3,
            "leonardo": 3, "leo": 2, "dicaprio": 4, "kate winslet": 4, "winslet": 3,
            "jack and rose": 4, "rose": 1, "jack": 2 },
    scenes: [
      { keys: ["iceberg", "hits", "crash"], label: "the ship hits the iceberg", at: "1:39:20" },
      { keys: ["king of the world", "front of the ship", "bow", "flying"], label: "“I'm the king of the world”", at: "0:37:40" }
    ]
  },
  {
    id: "godfather", title: "The Godfather", year: 1972, kind: "Movie", runtime: "2:55:00",
    source: "streaming", service: "Paramount+", colors: ["#4A3424", "#0B0705"],
    keys: { "godfather": 8, "the godfather": 8, "brando": 4, "marlon": 3, "al pacino": 4, "pacino": 3,
            "corleone": 5, "mafia": 3, "mob": 2, "sonny": 3, "michael": 1, "don": 1 },
    scenes: [
      { keys: ["sonny", "killed", "shot", "dies", "toll", "causeway"], label: "right after Sonny is killed", at: "1:51:04" },
      { keys: ["horse", "bed"], label: "the horse head scene", at: "0:38:10" },
      { keys: ["wedding", "beginning", "start"], label: "the opening wedding", at: "0:00:00" }
    ]
  },
  {
    id: "jaws", title: "Jaws", year: 1975, kind: "Movie", runtime: "2:04:00",
    source: "streaming", service: "Peacock", colors: ["#1F5C7A", "#041019"],
    keys: { "jaws": 8, "shark": 5, "great white": 4, "boat": 2, "beach": 2, "spielberg": 2 },
    scenes: [
      { keys: ["bigger boat"], label: "“You're gonna need a bigger boat”", at: "1:09:30" }
    ]
  },
  {
    id: "pirates", title: "Pirates of the Caribbean", year: 2003, kind: "Movie", runtime: "2:23:00",
    source: "streaming", service: "Disney+", colors: ["#5C4A2A", "#100C05"],
    keys: { "pirates": 6, "pirate": 5, "caribbean": 5, "johnny depp": 5, "depp": 4,
            "jack sparrow": 6, "sparrow": 4, "ship": 2, "boat": 2, "jack": 2 },
    scenes: []
  },
  {
    id: "soundofmusic", title: "The Sound of Music", year: 1965, kind: "Movie", runtime: "2:54:00",
    source: "streaming", service: "Disney+", colors: ["#3F6B3A", "#0B1A0A"],
    keys: { "sound of music": 8, "julie andrews": 5, "andrews": 3, "von trapp": 5, "nun": 3,
            "maria": 3, "alps": 3, "hills are alive": 6 },
    scenes: [
      { keys: ["do re mi", "doe a deer", "do-re-mi"], label: "“Do-Re-Mi”", at: "0:52:00" },
      { keys: ["hills are alive", "beginning", "opening"], label: "“The Hills Are Alive”", at: "0:01:30" }
    ]
  },
  {
    id: "casablanca", title: "Casablanca", year: 1942, kind: "Movie", runtime: "1:42:00",
    source: "streaming", service: "Max", colors: ["#3A3A3A", "#0A0A0A"],
    keys: { "casablanca": 8, "bogart": 5, "humphrey": 3, "ingrid bergman": 5, "bergman": 3,
            "here's looking at you": 6, "rick's": 3 },
    scenes: [
      { keys: ["airport", "ending", "plane", "goodbye"], label: "the airport goodbye", at: "1:38:00" }
    ]
  },
  {
    id: "goldengirls", title: "The Golden Girls", year: 1985, kind: "Show", runtime: "0:24:00",
    source: "streaming", service: "Hulu", colors: ["#7A5B6B", "#1A0F15"],
    keys: { "golden girls": 8, "golden": 3, "girls": 1, "betty white": 5, "dorothy": 3,
            "blanche": 4, "sophia": 3, "rose nylund": 5, "cheesecake": 3 },
    scenes: []
  },

  // Live TV on the room's local cable box
  {
    id: "cubs", title: "Cubs baseball", year: null, kind: "Live game", runtime: null,
    source: "cable", channel: "32", colors: ["#2F7A44", "#0C2416"],
    live: { away: "VISITORS", awayScore: 2, home: "CUBS", homeScore: 3, status: "Bottom 6th" },
    keys: { "cubs": 8, "cubbies": 6, "baseball": 4, "ballgame": 4, "ball game": 4,
            "wrigley": 4, "the game": 2, "game": 1 },
    scenes: []
  },
  {
    id: "news", title: "Local News", year: null, kind: "Live", runtime: null,
    source: "cable", channel: "2", colors: ["#2A3F6B", "#070D1A"],
    keys: { "news": 6, "local news": 8, "the news": 6, "headlines": 4 },
    scenes: []
  },
  {
    id: "weather", title: "The Weather Channel", year: null, kind: "Live", runtime: null,
    source: "cable", channel: "48", colors: ["#2A6B8A", "#06141C"],
    keys: { "weather": 8, "forecast": 6, "rain": 2, "snow": 2 },
    scenes: []
  },
  {
    id: "wheel", title: "Wheel of Fortune", year: null, kind: "Live", runtime: null,
    source: "cable", channel: "7", colors: ["#6B2A5C", "#1A0716"],
    keys: { "wheel of fortune": 8, "wheel": 5, "vanna": 4, "pat sajak": 4, "game show": 2 },
    scenes: []
  }
];

// What the room was last watching (for "What was I watching?")
window.FLOW_LAST_WATCHED = { id: "goldengirls", episode: "Season 4, Episode 9", at: "0:12:31" };
