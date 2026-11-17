// Battle-view camera shared by the panorama and the mini-games. The active view replaces these methods.
export const camera = {
  focus(_col, _zoom) {},
  wide() {},
};

// Panorama geometry, in % of the view: the 30 columns span X0..X1; row r stands groundY(r) up from the bottom.
export const X0 = 4, X1 = 96;
export const groundY = (row) => 3 + row * 6.2;
export const depth = (row) => 1 - row * 0.085;
