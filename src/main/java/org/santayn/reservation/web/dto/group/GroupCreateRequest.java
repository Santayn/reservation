// org/santayn/reservation/web/dto/group/GroupCreateRequest.java
package org.santayn.reservation.web.dto.group;
import jakarta.validation.constraints.NotBlank;
public record GroupCreateRequest(
        @NotBlank String name,
        String title,
        Integer courseCode
) {}
