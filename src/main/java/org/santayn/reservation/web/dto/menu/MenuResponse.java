package org.santayn.reservation.web.dto.menu;

import java.util.List;

public record MenuResponse(
        String title,
        List<ActionDto> actions,
        String generatedAt,
        MetaDto meta
) {}
