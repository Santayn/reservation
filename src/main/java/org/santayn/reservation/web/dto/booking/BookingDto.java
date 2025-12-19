package org.santayn.reservation.web.dto.booking;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record BookingDto(
        Long id,
        LocalDate date,
        Long classroomId,
        String classroomName,
        Integer classroomCapacity,
        Long slotId,
        LocalTime slotFrom,
        LocalTime slotTo,
        List<GroupEntry> groups,
        Integer totalLoad
) {
    public record GroupEntry(Integer id, String name, Integer size) {}
}
