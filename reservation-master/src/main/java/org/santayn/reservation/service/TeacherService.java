// org/santayn/reservation/service/TeacherService.java
package org.santayn.reservation.service;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.user.User;
import org.santayn.reservation.repositories.FacultyRepository;
import org.santayn.reservation.repositories.UserRepository;
import org.santayn.reservation.web.dto.teacher.TeacherCreateRequest;
import org.santayn.reservation.web.dto.teacher.TeacherDto;
import org.santayn.reservation.web.exception.NotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
public class TeacherService {

    private final UserRepository userRepo;
    private final FacultyRepository facultyRepo;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public TeacherDto create(TeacherCreateRequest r) {
        var faculty = facultyRepo.findById(r.facultyId())
                .orElseThrow(() -> new NotFoundException("Faculty not found: " + r.facultyId()));

        // В DTO сейчас поле называется passwordHash, но сюда может прийти как «сырой» пароль, так и готовый хэш.
        // Если это не bcrypt-хэш — кодируем.
        String incoming = r.passwordHash();
        String hashToStore = isBcrypt(incoming) ? incoming : passwordEncoder.encode(incoming);

        var u = User.builder()
                .fullName(r.fullName())
                .login(r.login())
                .passwordHash(hashToStore)
                .admin(false) // преподаватель не админ
                .faculty(faculty)
                .build();

        u = userRepo.save(u);
        return new TeacherDto(u.getId(), u.getFullName(), u.getLogin(), faculty.getId());
    }

    @Transactional(readOnly = true)
    public List<TeacherDto> list() {
        return userRepo.findAll().stream()
                .filter(u -> !u.isAdmin())
                .map(u -> new TeacherDto(
                        u.getId(),
                        u.getFullName(),
                        u.getLogin(),
                        u.getFaculty() != null ? u.getFaculty().getId() : null
                ))
                .toList();
    }

    @Transactional
    public void delete(Long id) {
        if (!userRepo.existsById(id)) {
            throw new NoSuchElementException("User with id=" + id + " not found");
        }
        userRepo.deleteById(id);
    }

    private boolean isBcrypt(String value) {
        if (value == null) return false;
        // Примерные формы: $2a$, $2b$, $2y$
        return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
    }
}
