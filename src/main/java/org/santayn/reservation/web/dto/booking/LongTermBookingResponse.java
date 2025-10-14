package org.santayn.reservation.web.dto.booking;

import java.util.List;

/** Результат массового создания броней. */
public record LongTermBookingResponse(
        int createdCount,
        List<Long> bookingIds,
        List<BookingConflictDto> conflicts
) {}
