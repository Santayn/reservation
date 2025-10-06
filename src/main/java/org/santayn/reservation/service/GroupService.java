package org.santayn.reservation.service;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.faculty.Faculty;
import org.santayn.reservation.models.group.Group;
import org.santayn.reservation.models.group.GroupFaculty;
import org.santayn.reservation.repositories.FacultyRepository;
import org.santayn.reservation.repositories.GroupFacultyRepository;
import org.santayn.reservation.repositories.GroupRepository;
import org.santayn.reservation.web.dto.group.GroupCreateRequest;
import org.santayn.reservation.web.dto.group.GroupDto;
import org.santayn.reservation.web.dto.group.GroupUpdateRequest;
import org.santayn.reservation.web.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository repo;
    private final GroupFacultyRepository groupFacultyRepo;
    private final FacultyRepository facultyRepo;

    @Transactional
    public GroupDto create(GroupCreateRequest r) {
        // создаём группу
        var g = Group.builder()
                .name(r.name())
                .personsCount(r.personsCount())
                .build();
        g = repo.save(g);

        // при необходимости создаём связь с факультетом
        Long facultyId = null;
        if (r.facultyId() != null) {
            facultyId = linkFaculty(g.getId(), r.facultyId());
        }

        return toDto(g, facultyId);
    }

    @Transactional(readOnly = true)
    public List<GroupDto> list() {
        return repo.findAll().stream()
                .map(g -> toDto(g, firstFacultyId(g.getId())))
                .toList();
    }

    @Transactional
    public GroupDto update(Long id, GroupUpdateRequest r) {
        var g = repo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Группа с id=" + id + " не найдена"));

        g.setName(r.name());
        g.setPersonsCount(r.personsCount());
        g = repo.save(g);

        Long facultyId = null;
        if (r.facultyId() != null) {
            facultyId = linkFaculty(id, r.facultyId());
        } else {
            facultyId = firstFacultyId(id);
        }

        return toDto(g, facultyId);
    }

    @Transactional
    public void delete(Long id) {
        if (!repo.existsById(id)) {
            throw new NoSuchElementException("Группа с id=" + id + " не найдена");
        }
        repo.deleteById(id);
        // связи group↔faculty/group↔teacher/booking_groups удалятся каскадно на уровне БД (если сконфигурировано)
    }

    // ---------- helpers ----------

    /** Гарантирует наличие связи group↔faculty, проверяет существование факультета. Возвращает facultyId. */
    private Long linkFaculty(Long groupId, Long facultyId) {
        Faculty f = facultyRepo.findById(facultyId)
                .orElseThrow(() -> new NotFoundException("Faculty not found: " + facultyId));

        if (!groupFacultyRepo.existsByGroup_IdAndFaculty_Id(groupId, facultyId)) {
            GroupFaculty.Id id = new GroupFaculty.Id(groupId, facultyId);
            groupFacultyRepo.save(
                    GroupFaculty.builder()
                            .id(id)
                            .group(repo.getReferenceById(groupId))
                            .faculty(f)
                            .build()
            );
        }
        return facultyId;
    }

    /** Возвращает любой (первый) facultyId, связанный с группой, либо null. */
    private Long firstFacultyId(Long groupId) {
        return groupFacultyRepo.findByGroup_Id(groupId).stream()
                .findFirst()
                .map(gf -> gf.getFaculty().getId())
                .orElse(null);
    }

    private GroupDto toDto(Group g, Long facultyId) {
        return new GroupDto(
                g.getId(),
                g.getName(),
                g.getPersonsCount(),
                facultyId
        );
    }
}
