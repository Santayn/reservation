// src/main/java/org/santayn/reservation/service/ClassroomService.java
package org.santayn.reservation.service;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.building.Building;
import org.santayn.reservation.models.classroom.Classroom;
import org.santayn.reservation.models.classroom.ClassroomFaculty;
import org.santayn.reservation.models.classroom.ClassroomSpecialization;
import org.santayn.reservation.models.faculty.Faculty;
import org.santayn.reservation.models.specialization.Specialization;
import org.santayn.reservation.repositories.*;
import org.santayn.reservation.web.dto.classroom.*;
import org.santayn.reservation.web.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ClassroomService {

    private final ClassroomRepository classroomRepo;
    private final BuildingRepository buildingRepo;
    private final FacultyRepository facultyRepo;
    private final SpecializationRepository specializationRepo;
    private final ClassroomFacultyRepository classroomFacultyRepo;
    private final ClassroomSpecializationRepository classroomSpecRepo;

    @Transactional
    public ClassroomDto create(ClassroomCreateRequest r) {
        Classroom c = Classroom.builder()
                .name(r.name())
                .capacity(Optional.ofNullable(r.capacity()).orElse(0))
                .build();

        if (r.buildingId() != null) {
            Building b = buildingRepo.findById(r.buildingId())
                    .orElseThrow(() -> new NotFoundException("Building not found: " + r.buildingId()));
            c.setBuilding(b);
        }

        c = classroomRepo.save(c);
        syncFaculties(c.getId(), safeIds(r.facultyIds()));
        syncSpecializations(c.getId(), safeIds(r.specializationIds()));
        return toDto(c);
    }

    @Transactional(readOnly = true)
    public List<ClassroomDto> list() {
        return classroomRepo.findAll().stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public ClassroomDto get(Long id) {
        Classroom c = classroomRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Classroom not found: " + id));
        return toDto(c);
    }

    @Transactional
    public ClassroomDto update(Long id, ClassroomUpdateRequest r) {
        Classroom c = classroomRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Classroom not found: " + id));

        if (r.capacity() != null) c.setCapacity(r.capacity());

        if (r.buildingId() != null) {
            Building b = buildingRepo.findById(r.buildingId())
                    .orElseThrow(() -> new NotFoundException("Building not found: " + r.buildingId()));
            c.setBuilding(b);
        } else {
            c.setBuilding(null);
        }

        c = classroomRepo.save(c);
        syncFaculties(id, safeIds(r.facultyIds()));
        syncSpecializations(id, safeIds(r.specializationIds()));
        return toDto(c);
    }

    @Transactional
    public void delete(Long id) {
        if (!classroomRepo.existsById(id)) throw new NotFoundException("Classroom not found: " + id);
        classroomRepo.deleteById(id);
    }

    /** Для фронта: найти по name, если нет — создать (с capacity). */
    // src/main/java/org/santayn/reservation/service/ClassroomService.java
    @Transactional
    public ClassroomDto ensureByName(ClassroomEnsureRequest req) {
        String key = Optional.ofNullable(req.name()).orElse("").trim();
        if (key.isEmpty()) {
            throw new NotFoundException("Classroom not found: <empty>");
        }

        // 1) пробуем точное имя
        Optional<Classroom> found = classroomRepo.findByName(key);

        // 2) если не найдено — пробуем по короткому коду/вхождению
        if (found.isEmpty()) {
            // вытаскиваем цифры, чтобы "Ауд. 102" и "102" совпали
            String digits = key.replaceAll("\\D+", "");
            if (!digits.isBlank()) {
                found = classroomRepo.findFirstByNameContainingIgnoreCase(digits);
            } else {
                // если цифр нет, ищем хотя бы по вхождению исходной строки
                found = classroomRepo.findFirstByNameContainingIgnoreCase(key);
            }
        }

        Classroom c = found.orElseGet(() -> {
            // если пришёл чистый код — создаём с префиксом "Ауд. "
            String nameToCreate = key.matches("\\d+") ? "Ауд. " + key : key;
            return classroomRepo.save(
                    Classroom.builder()
                            .name(nameToCreate)
                            .capacity(Optional.ofNullable(req.capacity()).orElse(0))
                            .build()
            );
        });

        // при желании обновляем capacity у уже существующего
        if (req.capacity() != null && !Objects.equals(c.getCapacity(), req.capacity())) {
            c.setCapacity(req.capacity());
            c = classroomRepo.save(c);
        }

        return toDto(c);
    }


    // ---------- helpers.js ----------

    private ClassroomDto toDto(Classroom c) {
        Long buildingId = c.getBuilding() != null ? c.getBuilding().getId() : null;

        List<Long> facultyIds = classroomFacultyRepo.findByClassroom_Id(c.getId())
                .stream().map(cf -> cf.getFaculty().getId()).toList();

        List<Long> specIds = classroomSpecRepo.findByClassroom_Id(c.getId())
                .stream().map(cs -> cs.getSpecialization().getId()).toList();

        return new ClassroomDto(
                c.getId(), c.getName(),
                Optional.ofNullable(c.getCapacity()).orElse(0),
                buildingId, facultyIds, specIds
        );
    }

    private List<Long> safeIds(List<Long> ids) {
        return ids == null ? Collections.emptyList() : ids.stream().filter(Objects::nonNull).distinct().toList();
    }

    private void syncFaculties(Long classroomId, List<Long> expected) {
        var currentLinks = classroomFacultyRepo.findByClassroom_Id(classroomId);
        Set<Long> current = currentLinks.stream().map(cf -> cf.getFaculty().getId()).collect(Collectors.toSet());
        Set<Long> want = new HashSet<>(expected);

        for (Long fid : current) if (!want.contains(fid))
            classroomFacultyRepo.deleteByClassroom_IdAndFaculty_Id(classroomId, fid);

        for (Long fid : want) if (!current.contains(fid)) {
            Faculty f = facultyRepo.findById(fid).orElseThrow(() -> new NotFoundException("Faculty not found: " + fid));
            ClassroomFaculty.Id id = new ClassroomFaculty.Id(classroomId, fid);
            classroomFacultyRepo.save(ClassroomFaculty.builder()
                    .id(id)
                    .classroom(classroomRepo.getReferenceById(classroomId))
                    .faculty(f)
                    .build());
        }
    }

    private void syncSpecializations(Long classroomId, List<Long> expected) {
        var currentLinks = classroomSpecRepo.findByClassroom_Id(classroomId);
        Set<Long> current = currentLinks.stream().map(cs -> cs.getSpecialization().getId()).collect(Collectors.toSet());
        Set<Long> want = new HashSet<>(expected);

        for (Long sid : current) if (!want.contains(sid))
            classroomSpecRepo.deleteByClassroom_IdAndSpecialization_Id(classroomId, sid);

        for (Long sid : want) if (!current.contains(sid)) {
            Specialization s = specializationRepo.findById(sid).orElseThrow(() -> new NotFoundException("Specialization not found: " + sid));
            ClassroomSpecialization.Id id = new ClassroomSpecialization.Id(classroomId, sid);
            classroomSpecRepo.save(ClassroomSpecialization.builder()
                    .id(id)
                    .classroom(classroomRepo.getReferenceById(classroomId))
                    .specialization(s)
                    .build());
        }
    }
}
