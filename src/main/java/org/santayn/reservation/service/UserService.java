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
    @Transactional(readOnly = true)
    public UserMeDto me(Principal principal) {
        if (principal == null) throw new NotFoundException("Unauthorized");

        String login = principal.getName(); // Spring Security кладёт сюда username/login
        User u = userRepository.findByLogin(login)
                .orElseThrow(() -> new NotFoundException("User not found: " + login));

        String role = u.isAdmin() ? "ADMIN" : "USER";

        // В нашей модели нет firstName/lastName/email — отдаём null, login используем как отображаемое имя
        return new UserMeDto(u.getId(), null, null, u.getLogin(), null, role);
    }

    /** Обновление роли пользователя */
    @Transactional
    public void updateRole(Long userId, UpdateRoleRequest req) {
        var u = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));

        String role = req.role();
        boolean isAdmin;
        if ("ADMIN".equalsIgnoreCase(role)) {
            isAdmin = true;
        } else if ("USER".equalsIgnoreCase(role)) {
            isAdmin = false;
        } else {
            throw new IllegalArgumentException("Unsupported role: " + role + " (use ADMIN or USER)");
        }
        u.setAdmin(isAdmin);
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
        // displayName — используем login, так как fullName в модели нет
        return new UserDto(
                u.getId(),
                u.getLogin(),
                u.getLogin(),
                role
        );
    }
}
