export function reviewMetricPayload(metric) {
  return {
    phase: metric.phase,
    counter: metric.counter,
    delta: metric.delta,
    ...(metric.reset === true ? { reset: true } : {}),
  };
}

