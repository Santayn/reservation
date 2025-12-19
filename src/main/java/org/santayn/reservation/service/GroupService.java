package org.santayn.reservation.service;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.group.Group;
import org.santayn.reservation.repositories.FacultyRepository;
import org.santayn.reservation.repositories.GroupRepository;
import org.santayn.reservation.web.dto.group.GroupCreateRequest;
import org.santayn.reservation.web.dto.group.GroupDto;
import org.santayn.reservation.web.dto.group.GroupUpdateRequest;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository groupRepository;
    private final FacultyRepository facultyRepository;
    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public List<GroupDto> list() {
        return groupRepository.findAll(Sort.by(Sort.Order.asc("name")))
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public GroupDto get(Long id) {
        Group g = groupRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Группа не найдена: id=" + id));
        return toDto(g);
    }

    @Transactional
    public GroupDto create(GroupCreateRequest req) {
        if (req == null) throw new IllegalArgumentException("Пустой запрос создания группы");

        String name = req.name().trim();
        groupRepository.findByName(name).ifPresent(x -> {
            throw new IllegalArgumentException("Группа с таким названием уже существует: " + name);
        });

        Integer count = req.personsCount() == null ? 0 : Math.max(0, req.personsCount());

        Group entity = Group.builder()
                .name(name)
                .personsCount(count)
                .build();

        Group saved = groupRepository.save(entity);

        // Опциональная привязка к факультету
        if (req.facultyId() != null) {
            Long facultyId = req.facultyId();
            facultyRepository.findById(facultyId).orElseThrow(
                    () -> new NoSuchElementException("Факультет не найден: id=" + facultyId)
            );
            // on conflict do nothing — чтобы не падать при повторном вызове
            jdbcTemplate.update(
                    "insert into group_faculty (faculty_id, group_id) values (?, ?) " +
                            "on conflict (faculty_id, group_id) do nothing",
                    facultyId, saved.getId()
            );
        }

        return toDto(saved);
    }

    @Transactional
    public GroupDto update(Long id, GroupUpdateRequest req) {
        if (req == null) throw new IllegalArgumentException("Пустой запрос обновления группы");

        Group g = groupRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Группа не найдена: id=" + id));

        String newName = req.name().trim();
        if (!newName.equals(g.getName())) {
            groupRepository.findByName(newName).ifPresent(x -> {
                throw new IllegalArgumentException("Группа с таким названием уже существует: " + newName);
            });
            g.setName(newName);
        }

        g.setPersonsCount(req.personsCount() == null ? 0 : Math.max(0, req.personsCount()));
        Group saved = groupRepository.save(g);

        // Обновляем привязку факультета (один факультет максимум из UI)
        // Сначала удалим старые связи
        jdbcTemplate.update("delete from group_faculty where group_id = ?", saved.getId());

        if (req.facultyId() != null) {
            Long facultyId = req.facultyId();
            facultyRepository.findById(facultyId).orElseThrow(
                    () -> new NoSuchElementException("Факультет не найден: id=" + facultyId)
            );
            jdbcTemplate.update(
                    "insert into group_faculty (faculty_id, group_id) values (?, ?) " +
                            "on conflict (faculty_id, group_id) do nothing",
                    facultyId, saved.getId()
            );
        }

        return toDto(saved);
    }

    @Transactional
    public void delete(Long id) {
        if (!groupRepository.existsById(id)) {
            throw new NoSuchElementException("Группа не найдена: id=" + id);
        }
        // Удалим зависимые связи, чтобы не остался мусор
        try {
            jdbcTemplate.update("delete from group_faculty where group_id = ?", id);
        } catch (EmptyResultDataAccessException ignored) {}
        groupRepository.deleteById(id);
    }

    private GroupDto toDto(Group g) {
        return new GroupDto(
                g.getId(),
                g.getName(),
                Objects.requireNonNullElse(g.getPersonsCount(), 0)
        );
    }
}
