package org.santayn.reservation.web.dto.booking;

public record GroupShortResponse(
        Long id,          // <-- было Integer
        String name,
        Integer size
) {}
