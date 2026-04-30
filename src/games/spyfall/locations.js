// src/games/spyfall/locations.js — Canonical Spyfall location list
//
// Exactly 30 locations. Order is stable — indices are encoded in the URL bitmask.
// Never reorder or remove entries once published; only append new ones at the end
// (and update the bitmask width in index.js if you exceed 32 total).

export const SPYFALL_LOCATIONS = [
  'Airplane',
  'Airport',
  'Art Museum',
  'Bank',
  'Beach',
  'Casino',
  'Cathedral',
  'Circus Tent',
  'Corporate Party',
  'Cruise Ship',
  'Embassy',
  'Hospital',
  'Hotel',
  'Military Base',
  'Movie Studio',
  'Ocean Liner',
  'Passenger Train',
  'Pirate Ship',
  'Police Station',
  'Restaurant',
  'School',
  'Service Station',
  'Space Station',
  'Spa',
  'Sports Arena',
  'Submarine',
  'Supermarket',
  'Theater',
  'University',
  'White House',
];
// 30 entries — fits in 30 bits of a uint32 bitmask (2 bits reserved).
