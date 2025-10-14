package org.santayn.reservation.web.dto.booking;

import org.santayn.reservation.models.booking.BookingSeries;

public final class BookingSeriesMapper {

    private BookingSeriesMapper() {}

    public static BookingSeriesDto toDto(BookingSeries e) {
        return new BookingSeriesDto(
                e.getId(),
                e.getClassroom() != null ? e.getClassroom().getId() : null,
                e.getGroup() != null ? e.getGroup().getId() : null,
                e.getTimezone(),
                e.getFloor(),
                e.getDayOfWeek(),
                e.getScheduleType(),
                e.getWeekType(),
                e.getCreatedAt()
        );
    }
}
