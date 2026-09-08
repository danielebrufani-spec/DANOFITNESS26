type Entry = { id: string; show: () => void };

let activeId: string | null = null;
const queue: Entry[] = [];

export const requestPopup = (id: string, show: () => void) => {
  if (activeId === id || queue.some((e) => e.id === id)) return;
  if (!activeId) {
    activeId = id;
    show();
  } else {
    queue.push({ id, show });
  }
};

export const releasePopup = (id: string) => {
  if (activeId === id) {
    activeId = null;
    const next = queue.shift();
    if (next) {
      activeId = next.id;
      next.show();
    }
  } else {
    const i = queue.findIndex((e) => e.id === id);
    if (i >= 0) queue.splice(i, 1);
  }
};
