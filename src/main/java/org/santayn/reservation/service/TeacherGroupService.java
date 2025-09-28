// org/santayn/reservation/service/TeacherGroupService.java
package org.santayn.reservation.service;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.user.Teacher_Group;
import org.santayn.reservation.repositories.GroupRepository;
import org.santayn.reservation.repositories.TeacherGroupRepository;
import org.santayn.reservation.repositories.UserRepository;
import org.santayn.reservation.web.dto.group.GroupDto;
import org.santayn.reservation.web.dto.teacher.TeacherGroupCreateRequest;
import org.santayn.reservation.web.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service @RequiredArgsConstructor
public class TeacherGroupService {
    private final TeacherGroupRepository repo;
    private final UserRepository userRepo;
    private final GroupRepository groupRepo;

    @Transactional
    public void create(TeacherGroupCreateRequest r) {
        userRepo.findById(r.teacherId())
                .orElseThrow(() -> new NotFoundException("User (teacher) not found: " + r.teacherId()));
        groupRepo.findById(r.groupId())
                .orElseThrow(() -> new NotFoundException("Group not found: " + r.groupId()));

        if (!repo.existsByTeacherIdAndGroupId(r.teacherId(), r.groupId())) {
            repo.save(Teacher_Group.builder()
                    .teacherId(r.teacherId())
                    .groupId(r.groupId())
                    .build());
        }
    }

    @Transactional(readOnly = true)
    public List<GroupDto> listByTeacher(Long teacherId) {
        // проверим, что преподаватель существует (на всякий)
        userRepo.findById(teacherId)
                .orElseThrow(() -> new NotFoundException("User (teacher) not found: " + teacherId));

        return repo.findByTeacherId(teacherId).stream()
                .map(link -> groupRepo.findById(link.getGroupId())
                        .map(g -> new GroupDto(g.getId(), g.getName(), g.getTitle(), g.getCourseCode()))
                        .orElse(null))
                .filter(g -> g != null)
                .toList();
    }

    @Transactional
    public void deleteLink(Long teacherId, Integer groupId) {
        // ошибок не бросаем если уже нет — просто идемпотентная операция
        repo.deleteByTeacherIdAndGroupId(teacherId, groupId);
    }
}
