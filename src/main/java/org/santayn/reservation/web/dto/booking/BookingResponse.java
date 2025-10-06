package org.santayn.reservation.web.dto.booking;

import java.util.List;

public record BookingResponse(
        Long id,
        Long classroomId,
        String classroomName,
        List<GroupShortResponse> groups,
        String bookedBy
) {}
