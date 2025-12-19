package org.santayn.reservation.web.dto.booking;

import org.santayn.reservation.models.booking.Booking;

public record BookingSlim(
        Long id,
        Long classroomId,
        Long groupId,
        Integer floor
) {
    public static BookingSlim from(Booking b) {
        return new BookingSlim(
                b.getId(),
                b.getClassroomId(),
                b.getGroupId(),
                b.getFloor()
        );
    }
}
