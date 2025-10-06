package org.santayn.reservation.web.dto.specialization;

import jakarta.validation.constraints.NotBlank;

public record SpecializationCreateRequest(@NotBlank String name) {}
