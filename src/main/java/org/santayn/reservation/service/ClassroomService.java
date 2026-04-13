package org.santayn.reservation.service;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.building.Building;
import org.santayn.reservation.models.classroom.Classroom;
import org.santayn.reservation.models.classroom.ClassroomFaculty;
import org.santayn.reservation.models.classroom.ClassroomSpecialization;
import org.santayn.reservation.models.faculty.Faculty;
import org.santayn.reservation.models.specialization.Specialization;
import org.santayn.reservation.repositories.BuildingRepository;
import org.santayn.reservation.repositories.ClassroomFacultyRepository;
import org.santayn.reservation.repositories.ClassroomRepository;
import org.santayn.reservation.repositories.ClassroomSpecializationRepository;
import org.santayn.reservation.repositories.FacultyRepository;
import org.santayn.reservation.repositories.SpecializationRepository;
import org.santayn.reservation.web.dto.classroom.ClassroomCreateRequest;
import org.santayn.reservation.web.dto.classroom.ClassroomDto;
import org.santayn.reservation.web.dto.classroom.ClassroomEnsureRequest;
import org.santayn.reservation.web.dto.classroom.ClassroomUpdateRequest;
import org.santayn.reservation.web.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Логика работы с аудиториями.
 *
 * ВАЖНО: используем твою модель Classroom без поля этажа.
 * Привязка к Building остаётся (как и была).
 */
@Service
@RequiredArgsConstructor
public class ClassroomService {

    private final ClassroomRepository classroomRepo;
    private final BuildingRepository buildingRepo;
    private final FacultyRepository facultyRepo;
    private final SpecializationRepository specializationRepo;
    private final ClassroomFacultyRepository classroomFacultyRepo;
    private final ClassroomSpecializationRepository classroomSpecRepo;

    // ---------- CRUD ----------

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

    // ---------- ensureByName ----------

    /**
     * Найти аудиторию по имени (или токену), при отсутствии — создать.
     * building здесь не трогаем, как и раньше.
     */
    @Transactional
    public ClassroomDto ensureByName(ClassroomEnsureRequest req) {
        String key = Optional.ofNullable(req.name()).orElse("").trim();
        if (key.isEmpty()) throw new NotFoundException("Classroom not found: <empty>");

        Optional<Classroom> found = classroomRepo.findByName(key);
        if (found.isEmpty()) {
            String digits = key.replaceAll("\\D+", "");
            if (!digits.isBlank()) {
                found = classroomRepo.findFirstByNameContainingIgnoreCase(digits);
            } else {
                found = classroomRepo.findFirstByNameContainingIgnoreCase(key);
            }
        }

        Classroom c = found.orElseGet(() -> {
            String nameToCreate = key.matches("\\d+") ? "Ауд. " + key : key;
            return classroomRepo.save(
                    Classroom.builder()
                            .name(nameToCreate)
                            .capacity(Optional.ofNullable(req.capacity()).orElse(0))
                            .build()
            );
        });

        if (req.capacity() != null && !Objects.equals(c.getCapacity(), req.capacity())) {
            c.setCapacity(req.capacity());
            c = classroomRepo.save(c);
        }

        return toDto(c);
    }

    // ---------- upsert для сохранения схемы ----------

    /**
     * Вызывается при СОХРАНЕНИИ СХЕМЫ: создаёт/обновляет аудитории из layoutJson.
     * Никаких ссылок на этаж не пишем (в модели их нет). Здание тоже не трогаем.
     */
    @Transactional
    public Map<String, Long> upsertRoomsForLayout(Long buildingId, List<RoomCandidate> rooms) {
        Map<String, Long> classroomIdsByRoomKey = new HashMap<>();
        if (rooms == null || rooms.isEmpty()) return classroomIdsByRoomKey;

        Building building = null;
        if (buildingId != null) {
            building = buildingRepo.findById(buildingId)
                    .orElseThrow(() -> new NotFoundException("Building not found: " + buildingId));
        }

        for (RoomCandidate rc : rooms) {
            String roomName = Optional.ofNullable(rc.name()).orElse("").trim();
            if (roomName.isEmpty()) continue;
            Integer wantedCap = Optional.ofNullable(rc.capacity()).orElse(0);

            Classroom room = resolveRoomForLayout(building, rc, roomName, wantedCap);

            boolean changed = false;
            if (!Objects.equals(room.getName(), roomName)) {
                room.setName(roomName);
                changed = true;
            }
            if (!Objects.equals(room.getCapacity(), wantedCap)) {
                room.setCapacity(wantedCap);
                changed = true;
            }
            if (building != null && room.getBuilding() == null) {
                room.setBuilding(building);
                changed = true;
            }

            if (changed) {
                room = classroomRepo.save(room);
            }

            String key = Optional.ofNullable(rc.key()).orElse("").trim();
            if (!key.isEmpty()) {
                classroomIdsByRoomKey.put(key, room.getId());
            }
        }

        return classroomIdsByRoomKey;
    }

    // ---------- вспомогательные типы/методы ----------

    /** Упрощённая запись аудитории из layoutJson. */
    public record RoomCandidate(String key, Long classroomId, String name, Integer capacity) {}

    private Classroom resolveRoomForLayout(Building building, RoomCandidate rc, String roomName, Integer capacity) {
        Long buildingId = building != null ? building.getId() : null;
        Long requestedId = rc.classroomId();

        if (requestedId != null) {
            Optional<Classroom> byId = classroomRepo.findById(requestedId)
                    .filter(room -> roomBelongsToLayoutBuilding(room, buildingId));
            if (byId.isPresent()) {
                return byId.get();
            }
        }

        if (buildingId != null) {
            Optional<Classroom> byBuildingAndName = classroomRepo.findByBuilding_IdAndNameIgnoreCase(buildingId, roomName);
            if (byBuildingAndName.isPresent()) {
                return byBuildingAndName.get();
            }

            Optional<Classroom> unbound = classroomRepo.findByBuildingIsNullAndNameIgnoreCase(roomName);
            if (unbound.isPresent()) {
                return unbound.get();
            }
        } else {
            Optional<Classroom> byName = classroomRepo.findByNameIgnoreCase(roomName);
            if (byName.isPresent()) {
                return byName.get();
            }
        }

        return classroomRepo.save(
                Classroom.builder()
                        .name(roomName)
                        .capacity(capacity)
                        .building(building)
                        .build()
        );
    }

    private boolean roomBelongsToLayoutBuilding(Classroom room, Long layoutBuildingId) {
        if (layoutBuildingId == null) return true;
        if (room.getBuilding() == null) return true;
        return Objects.equals(room.getBuilding().getId(), layoutBuildingId);
    }

    private ClassroomDto toDto(Classroom c) {
        Long buildingId = c.getBuilding() != null ? c.getBuilding().getId() : null;

        List<Long> facultyIds = classroomFacultyRepo.findByClassroom_Id(c.getId())
                .stream().map(cf -> cf.getFaculty().getId()).toList();

        List<Long> specIds = classroomSpecRepo.findByClassroom_Id(c.getId())
                .stream().map(cs -> cs.getSpecialization().getId()).toList();

        return new ClassroomDto(
                c.getId(),
                c.getName(),
                Optional.ofNullable(c.getCapacity()).orElse(0),
                buildingId,
                facultyIds,
                specIds
        );
    }

    private List<Long> safeIds(List<Long> ids) {
        return ids == null ? Collections.emptyList()
                : ids.stream().filter(Objects::nonNull).distinct().toList();
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
