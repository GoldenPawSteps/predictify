// Log-sum-exp trick for numerical stability
function logSumExp(values) {
  const max = Math.max(...values);
  if (!isFinite(max)) return max;
  return max + Math.log(values.reduce((sum, v) => sum + Math.exp(v - max), 0));
}

// Cost function C(q) = β * ln(Σ pᵢ * exp(qᵢ/β))
function costFunction(quantities, probabilities, beta) {
  const logTerms = quantities.map((q, i) => Math.log(probabilities[i]) + q / beta);
  return beta * logSumExp(logTerms);
}

// Liquidity cost L = -β / ln(min(p))
function liquidityCost(probabilities, beta) {
  const minP = Math.min(...probabilities);
  return -beta / Math.log(minP);
}

// Gradient (price measure) dC(q)[x] = Σᵢ xᵢ * softmax_i
// softmax_i = pᵢ * exp(qᵢ/β) / Σⱼ pⱼ * exp(qⱼ/β)
function gradientDotProduct(quantities, probabilities, beta, x) {
  const logTerms = quantities.map((q, i) => Math.log(probabilities[i]) + q / beta);
  const maxLog = Math.max(...logTerms);
  const expTerms = logTerms.map(v => Math.exp(v - maxLog));
  const sumExp = expTerms.reduce((a, b) => a + b, 0);
  const softmax = expTerms.map(e => e / sumExp);
  return x.reduce((sum, xi, i) => sum + xi * softmax[i], 0);
}

// Current prices (softmax vector)
function getPrices(quantities, probabilities, beta) {
  const logTerms = quantities.map((q, i) => Math.log(probabilities[i]) + q / beta);
  const maxLog = Math.max(...logTerms);
  const expTerms = logTerms.map(v => Math.exp(v - maxLog));
  const sumExp = expTerms.reduce((a, b) => a + b, 0);
  return expTerms.map(e => e / sumExp);
}

module.exports = { costFunction, liquidityCost, gradientDotProduct, getPrices, logSumExp };
