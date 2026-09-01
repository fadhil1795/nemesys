/**
 * PON Calculator
 * Ported from GACS-Dashboard
 */

// Insertion loss (applies to all splitters)
export const INSERTION_LOSS = 0.7; // dB

// Splitter ratio losses (in dB) - WITHOUT insertion loss
export const SPLITTER_LOSSES: Record<string, number> = {
  '1:2': 3.01,
  '1:4': 6.02,
  '1:8': 9.03,
  '1:16': 12.04,
  '1:32': 15.05,
  '1:64': 18.06,
};

// Custom ratio losses for each port (calculated from percentage)
// Formula: Loss (dB) = 10 × log10(1 / percentage)
export const CUSTOM_RATIO_LOSSES: Record<string, Record<string, number>> = {
  '20:80': {
    '20': 6.99,
    '80': 0.97,
  },
  '30:70': {
    '30': 5.23,
    '70': 1.55,
  },
  '50:50': {
    '50': 3.01,
  },
};

export interface PONCalculationResult {
  input_power: number;
  splitter_ratio: string;
  fiber_loss: number;
  distance: number;
  splitter_loss: number;
  custom_ratio_loss: number;
  total_fiber_loss: number;
  total_loss: number;
  output_power: number;
  next_odp_power: number;
  signal_quality: 'Excellent' | 'Good' | 'Fair' | 'Poor';
}

/**
 * Calculate optical power budget
 */
export function calculatePONPower(
  inputPower: number,
  splitterRatio: string = '1:8',
  fiberLoss: number = 0.5,
  distance: number = 0,
  customRatio?: string,
  customRatioPort?: string
): PONCalculationResult {
  
  // Get splitter loss
  const splitterLoss = SPLITTER_LOSSES[splitterRatio] ?? 10.5;

  // Calculate custom ratio loss if provided
  let customRatioLoss = 0;
  if (customRatio && customRatioPort && CUSTOM_RATIO_LOSSES[customRatio]?.[customRatioPort]) {
    customRatioLoss = CUSTOM_RATIO_LOSSES[customRatio][customRatioPort];
  }

  // Calculate total fiber loss
  const totalFiberLoss = fiberLoss * distance;

  // Calculate total loss (add insertion loss)
  const totalLoss = splitterLoss + customRatioLoss + totalFiberLoss + INSERTION_LOSS;

  // Calculate output power
  const outputPower = inputPower - totalLoss;

  // Calculate next node power
  const nextOdpPower = inputPower - customRatioLoss - totalFiberLoss - INSERTION_LOSS;

  let signalQuality: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  if (outputPower >= -20) signalQuality = 'Excellent';
  else if (outputPower >= -25) signalQuality = 'Good';
  else if (outputPower >= -27) signalQuality = 'Fair';
  else signalQuality = 'Poor';

  return {
    input_power: inputPower,
    splitter_ratio: splitterRatio,
    fiber_loss: fiberLoss,
    distance,
    splitter_loss: splitterLoss,
    custom_ratio_loss: customRatioLoss,
    total_fiber_loss: totalFiberLoss,
    total_loss: totalLoss,
    output_power: outputPower,
    next_odp_power: nextOdpPower,
    signal_quality: signalQuality,
  };
}
