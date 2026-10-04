export type ActiveLaunch = {
  readonly id: number;
  readonly onClose: (code: number) => void;
  cancelled: boolean;
};

export class LaunchPreparationCancelled extends Error {
  constructor() { super('Launch preparation cancelled'); }
}

