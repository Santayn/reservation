// org/santayn/reservation/web/dto/faculty/FacultyCreateRequest.java
package org.santayn.reservation.web.dto.faculty;
import jakarta.validation.constraints.NotBlank;
public record FacultyCreateRequest(@NotBlank String name) {}
