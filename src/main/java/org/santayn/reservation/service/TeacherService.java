package org.santayn.reservation.service;

import jakarta.validation.Valid;
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

@Service
@RequiredArgsConstructor
public class TeacherService {

    private final UserRepository userRepo;
    private final FacultyRepository facultyRepo;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public TeacherDto create(@Valid TeacherCreateRequest r) {
        // Проверка наличия факультета
        var faculty = facultyRepo.findById(r.facultyId())
                .orElseThrow(() -> new NotFoundException("Faculty not found: " + r.facultyId()));

        // Проверка уникальности логина
        if (userRepo.existsByLogin(r.login())) {
            throw new IllegalArgumentException("Login already exists: " + r.login());
        }

        // Создаём пользователя-преподавателя (admin=false), хэшируем пароль
        var u = User.builder()
                .login(r.login())
                .passwordHash(passwordEncoder.encode(r.password()))
                .admin(false)
                .faculty(faculty)
                .build();

        u = userRepo.save(u);
        return new TeacherDto(u.getId(), u.getLogin(), faculty.getId());
    }

    @Transactional(readOnly = true)
    public List<TeacherDto> list() {
        return userRepo.findAll().stream()
                .filter(u -> !u.isAdmin())
                .map(u -> new TeacherDto(
                        u.getId(),
                        u.getLogin(),
                        u.getFaculty() != null ? u.getFaculty().getId() : null
                ))
                .toList();
    }

    @Transactional
    public void delete(Long id) {
        var u = userRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found: " + id));
        if (u.isAdmin()) {
            throw new IllegalArgumentException("Cannot delete admin user with id=" + id);
        }
        userRepo.deleteById(id);
    }
}
