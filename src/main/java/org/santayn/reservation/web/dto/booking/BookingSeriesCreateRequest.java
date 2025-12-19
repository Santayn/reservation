package org.santayn.reservation.web.dto.booking;

import jakarta.validation.constraints.*;
import org.santayn.reservation.models.booking.BookingSeries;

public record BookingSeriesCreateRequest(
        @NotNull Long classroomId,
        @NotNull Long groupId,
        @NotBlank @Size(max = 64) String timezone,
        @NotNull Integer floor,
        @NotNull @Min(1) @Max(7) Integer dayOfWeek,
        @NotNull BookingSeries.ScheduleType scheduleType,
        @NotNull BookingSeries.WeekType weekType
) {}
