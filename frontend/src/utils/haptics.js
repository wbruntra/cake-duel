export function tap() {
  navigator.vibrate?.(10)
}

export function success() {
  navigator.vibrate?.([20, 40, 20])
}
