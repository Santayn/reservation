// org/santayn/reservation/web/dto/user/UpdateRoleRequest.java
package org.santayn.reservation.web.dto.user;

import jakarta.validation.constraints.NotBlank;

public record UpdateRoleRequest(
        @NotBlank(message = "Role is required")
        String role
) {}
