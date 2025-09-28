// org/santayn/reservation/web/dto/user/UserDto.java
package org.santayn.reservation.web.dto.user;

public record UserDto(
        Long id,
        String fullName,
        String login,
        String role
) {}
