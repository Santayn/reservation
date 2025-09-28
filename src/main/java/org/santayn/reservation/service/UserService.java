// org/santayn/reservation/service/UserService.java
package org.santayn.reservation.service;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.user.User;
import org.santayn.reservation.repositories.UserRepository;
import org.santayn.reservation.web.dto.user.UpdateRoleRequest;
import org.santayn.reservation.web.dto.user.UserMeDto;
import org.santayn.reservation.web.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.Principal;

@Service @RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;

    public UserMeDto me(Principal principal) {
        if (principal == null) {
            throw new NotFoundException("Unauthorized");
        }
        String email = principal.getName(); // по умолчанию Spring Security кладёт логин сюда
        User u = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found: " + email));

        // Адаптируем под фронт: login = email; разбиваем ФИО на имя/фамилию по пробелу (если нужно)
        String firstName = null, lastName = null;
        if (u.getFullName() != null && !u.getFullName().isBlank()) {
            var parts = u.getFullName().trim().split("\\s+", 2);
            firstName = parts[0];
            if (parts.length > 1) lastName = parts[1];
        }
        String role = u.isAdmin() ? "ADMIN" : "USER";

        return new UserMeDto(u.getId(), firstName, lastName, u.getEmail(), null, role);
    }

    @Transactional
    public void updateRole(Long userId, UpdateRoleRequest req) {
        var u = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));
        boolean admin = "ADMIN".equalsIgnoreCase(req.role());
        u.setAdmin(admin);
        userRepository.save(u);
    }
}
