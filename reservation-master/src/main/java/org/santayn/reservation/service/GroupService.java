// org/santayn/reservation/service/GroupService.java
package org.santayn.reservation.service;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.group.Group; // или твой класс Group, см. импорт
import org.santayn.reservation.repositories.GroupRepository;
import org.santayn.reservation.web.dto.group.GroupCreateRequest;
import org.santayn.reservation.web.dto.group.GroupDto;
import org.santayn.reservation.web.dto.group.GroupUpdateRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
public class GroupService {
    private final GroupRepository repo;

    @Transactional
    public GroupDto create(GroupCreateRequest r) {
        var g = Group.builder()
                .name(r.name())
                .title(r.title())
                .courseCode(r.courseCode())
                .capacity(r.size() == null ? 0 : r.size())
                .build();
        g = repo.save(g);
        return toDto(g);
    }

    @Transactional(readOnly = true)
    public List<GroupDto> list() {
        return repo.findAll().stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public GroupDto update(Integer id, GroupUpdateRequest r) {
        var g = repo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Группа с id=" + id + " не найдена"));
        g.setName(r.name());
        g.setTitle(r.title());
        g.setCourseCode(r.courseCode());
        g.setCapacity(r.size() == null ? 0 : r.size());
        return toDto(repo.save(g));
    }

    @Transactional
    public void delete(Integer id) {
        if (!repo.existsById(id)) {
            throw new NoSuchElementException("Группа с id=" + id + " не найдена");
        }
        repo.deleteById(id);
    }

    private GroupDto toDto(Group g) {
        return new GroupDto(
                g.getId(),
                g.getName(),
                g.getTitle(),
                g.getCourseCode(),
                g.getCapacity() == null ? 0 : g.getCapacity()
        );
    }
}
