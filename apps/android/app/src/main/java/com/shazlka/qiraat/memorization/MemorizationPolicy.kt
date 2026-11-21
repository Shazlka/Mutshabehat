package com.shazlka.qiraat.memorization

data class MemorizationPolicy(
    val statusWeights: Map<MemorizationStatus, Double>,
    val intervalLadderDays: List<Int>,
    val forgotIntervalDays: Int,
    val mistakesIntervalDays: Int,
    val confirmationAyahThreshold: Int,
    val milestonePercents: List<Int>,
) {
    fun weight(status: MemorizationStatus): Double = statusWeights[status] ?: 0.0

    companion object {
        val standard = MemorizationPolicy(
            statusWeights = mapOf(
                MemorizationStatus.MASTERED to 1.0,
                MemorizationStatus.MEMORIZED_WITH_ERRORS to 0.75,
                MemorizationStatus.NEEDS_MUSHAF to 0.4,
                MemorizationStatus.NOT_MEMORIZED to 0.0,
            ),
            intervalLadderDays = listOf(1, 3, 7, 14, 30, 60),
            forgotIntervalDays = 1,
            mistakesIntervalDays = 2,
            confirmationAyahThreshold = 30,
            milestonePercents = listOf(25, 50, 75, 100),
        )
    }
}
