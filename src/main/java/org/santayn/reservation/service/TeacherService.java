// org/santayn/reservation/service/TeacherService.java
package org.santayn.reservation.service;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.teacher.Teacher;
import org.santayn.reservation.repositories.FacultyRepository;
import org.santayn.reservation.repositories.TeacherRepository;
import org.santayn.reservation.web.dto.teacher.*;
import org.santayn.reservation.web.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service @RequiredArgsConstructor
public class TeacherService {
    private final TeacherRepository repo;
    private final FacultyRepository facultyRepo;

    @Transactional
    public TeacherDto create(TeacherCreateRequest r) {
        var faculty = facultyRepo.findById(r.facultyId())
                .orElseThrow(() -> new NotFoundException("Faculty not found: " + r.facultyId()));
        var t = Teacher.builder()
                .fullName(r.fullName())
                .login(r.login())
                .passwordHash(r.passwordHash())
                .faculty(faculty)
                .build();
        t = repo.save(t);
        return new TeacherDto(t.getId(), t.getFullName(), t.getLogin(), faculty.getId());
    }

    public List<TeacherDto> list() {
        return repo.findAll().stream()
                .map(t -> new TeacherDto(t.getId(), t.getFullName(), t.getLogin(), t.getFaculty().getId()))
                .toList();
    }
}
