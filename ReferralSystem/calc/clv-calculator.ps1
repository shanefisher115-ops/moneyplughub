function Calculate-CLVUplift {
    param(
        [float] $BaseCLV,
        [float] $UpliftPercent
    )
    return $BaseCLV * (1 + ($UpliftPercent / 100))
}
