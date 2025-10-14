package org.santayn.reservation.web.dto.booking;

import jakarta.validation.constraints.*;
import org.santayn.reservation.models.booking.BookingSeries;

public record BookingSeriesUpdateRequest(
        Long classroomId,
        Long groupId,
        @Size(max = 64) String timezone,
        Integer floor,
        @Min(1) @Max(7) Integer dayOfWeek,
        BookingSeries.ScheduleType scheduleType,
        BookingSeries.WeekType weekType
) {}
