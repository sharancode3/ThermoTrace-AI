export interface TourStep {
  id: string;
  route?: string;
  targetSelector: string;
  title: string;
  description: string;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: () => void;
  waitForElement?: boolean;
}

export interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}
