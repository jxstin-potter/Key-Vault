// Lets code outside the component tree (e.g. Zustand stores) trigger
// client-side navigation. Set once from a component inside <Router>.
let navigateFn = null;

export function setNavigate(fn) {
  navigateFn = fn;
}

export function navigateTo(path) {
  if (navigateFn) {
    navigateFn(path);
  } else {
    window.location.href = path;
  }
}
