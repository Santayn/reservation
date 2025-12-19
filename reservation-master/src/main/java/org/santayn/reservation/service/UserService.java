// org/santayn/reservation/service/UserService.java
package org.santayn.reservation.service;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.user.User;
import org.santayn.reservation.repositories.UserRepository;
import org.santayn.reservation.web.dto.user.UpdateRoleRequest;
import org.santayn.reservation.web.dto.user.UserDto;
import org.santayn.reservation.web.dto.user.UserMeDto;
import org.santayn.reservation.web.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.Principal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    /** Текущий пользователь по login из Principal */
    public UserMeDto me(Principal principal) {
        if (principal == null) throw new NotFoundException("Unauthorized");

        String login = principal.getName(); // Spring Security кладёт сюда username/login
        User u = userRepository.findByLogin(login)
                .orElseThrow(() -> new NotFoundException("User not found: " + login));

        String firstName = null, lastName = null;
        if (u.getFullName() != null && !u.getFullName().isBlank()) {
            var parts = u.getFullName().trim().split("\\s+", 2);
            firstName = parts[0];
            if (parts.length > 1) lastName = parts[1];
        }
        String role = u.isAdmin() ? "ADMIN" : "USER";

        // login вместо email
        return new UserMeDto(u.getId(), firstName, lastName, u.getLogin(), null, role);
    }

    /** Обновление роли пользователя */
    @Transactional
    public void updateRole(Long userId, UpdateRoleRequest req) {
        var u = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));
        u.setAdmin("ADMIN".equalsIgnoreCase(req.role()));
        userRepository.save(u);
    }

    /** Список всех пользователей для выпадающего списка */
    @Transactional(readOnly = true)
    public List<UserDto> listAll() {
        return userRepository.findAll().stream()
                .map(this::toDto)
                .toList();
    }

    private UserDto toDto(User u) {
        String role = u.isAdmin() ? "ADMIN" : "USER";
        // login вместо email
        return new UserDto(
                u.getId(),
                u.getFullName(),
                u.getLogin(),
                role
        );
    }
}
