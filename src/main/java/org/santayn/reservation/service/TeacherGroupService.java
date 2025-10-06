package org.santayn.reservation.service;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.group.Group;
import org.santayn.reservation.models.group.GroupTeacher;
import org.santayn.reservation.repositories.GroupFacultyRepository;
import org.santayn.reservation.repositories.GroupRepository;
import org.santayn.reservation.repositories.GroupTeacherRepository;
import org.santayn.reservation.repositories.UserRepository;
import org.santayn.reservation.web.dto.group.GroupDto;
import org.santayn.reservation.web.dto.teacher.TeacherGroupCreateRequest;
import org.santayn.reservation.web.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TeacherGroupService {

    private final GroupTeacherRepository repo;
    private final UserRepository userRepo;
    private final GroupRepository groupRepo;
    private final GroupFacultyRepository groupFacultyRepo;

    @Transactional
    public void create(@Valid TeacherGroupCreateRequest r) {
        // Валидируем наличие пользователя и группы
        userRepo.findById(r.teacherId())
                .orElseThrow(() -> new NotFoundException("User (teacher) not found: " + r.teacherId()));
        groupRepo.findById(r.groupId())
                .orElseThrow(() -> new NotFoundException("Group not found: " + r.groupId()));

        // Защита от дублей
        if (!repo.existsByTeacher_IdAndGroup_Id(r.teacherId(), r.groupId())) {
            GroupTeacher.Id id = new GroupTeacher.Id(r.groupId(), r.teacherId());
            GroupTeacher link = GroupTeacher.builder()
                    .id(id)
                    .group(groupRepo.getReferenceById(r.groupId()))
                    .teacher(userRepo.getReferenceById(r.teacherId()))
                    .role("teacher")
                    .build();
            repo.save(link);
        }
    }

    @Transactional(readOnly = true)
    public List<GroupDto> listByTeacher(Long teacherId) {
        // Убедимся, что преподаватель существует
        userRepo.findById(teacherId)
                .orElseThrow(() -> new NotFoundException("User (teacher) not found: " + teacherId));

        return repo.findByTeacher_Id(teacherId).stream()
                .map(GroupTeacher::getGroup)
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public void deleteLink(Long teacherId, Long groupId) {
        // Идемпотентно: если связи нет — просто ничего не произойдёт
        repo.deleteByTeacher_IdAndGroup_Id(teacherId, groupId);
    }

    private GroupDto toDto(Group g) {
        // facultyId берём через связку group_faculty (если есть — берём первый)
        Long facultyId = groupFacultyRepo.findByGroup_Id(g.getId()).stream()
                .findFirst()
                .map(gf -> gf.getFaculty().getId())
                .orElse(null);

        return new GroupDto(
                g.getId(),
                g.getName(),
                g.getPersonsCount(),
                facultyId
        );
    }
}
