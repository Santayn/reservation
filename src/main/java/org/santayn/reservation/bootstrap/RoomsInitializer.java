package org.santayn.reservation.bootstrap;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.building.Building;
import org.santayn.reservation.models.classroom.Classroom;
import org.santayn.reservation.repositories.BuildingRepository;
import org.santayn.reservation.repositories.ClassroomRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Инициализатор только для КАБИНЕТОВ.
 * Создаёт корпуса (Левый, Центр, Правый) при отсутствии
 * и наполняет аудитории согласно фронтовой схеме.
 */
@Component
@RequiredArgsConstructor
public class RoomsInitializer implements ApplicationRunner {

    private final ClassroomRepository classroomRepo;
    private final BuildingRepository buildingRepo;

    @Getter
    @AllArgsConstructor
    private static class RoomDef {
        private final String name;     // "Ауд. 102", "Фойе" и т.п.
        private final int capacity;    // вместимость
        private final String building; // "Левый корпус" | "Центр" | "Правый корпус"
    }

    // Корпуса из фронта
    private static final String LEFT   = "Левый корпус";
    private static final String CENTER = "Центр";
    private static final String RIGHT  = "Правый корпус";

    // Полный список кабинетов из твоей HTML-схемы
    private static final List<RoomDef> ROOMS = List.of(
            // ЛЕВЫЙ, этаж 1
            new RoomDef("Ауд. 101", 30, LEFT), new RoomDef("Ауд. 102", 25, LEFT),
            new RoomDef("Ауд. 103", 40, LEFT), new RoomDef("Ауд. 104", 28, LEFT),
            new RoomDef("Ауд. 105", 35, LEFT), new RoomDef("Ауд. 106", 22, LEFT),
            new RoomDef("Ауд. 107", 32, LEFT), new RoomDef("Ауд. 108", 27, LEFT),
            new RoomDef("Ауд. 109", 40, LEFT), new RoomDef("Ауд. 110", 36, LEFT),

            // ЛЕВЫЙ, этаж 2
            new RoomDef("Ауд. 201", 34, LEFT), new RoomDef("Ауд. 202", 26, LEFT),
            new RoomDef("Ауд. 203", 38, LEFT), new RoomDef("Ауд. 204", 25, LEFT),
            new RoomDef("Ауд. 205", 42, LEFT), new RoomDef("Ауд. 206", 29, LEFT),
            new RoomDef("Ауд. 207", 31, LEFT), new RoomDef("Ауд. 208", 24, LEFT),
            new RoomDef("Ауд. 209", 39, LEFT), new RoomDef("Ауд. 210", 30, LEFT),

            // ЛЕВЫЙ, этаж 3
            new RoomDef("Ауд. 301", 28, LEFT), new RoomDef("Ауд. 302", 33, LEFT),
            new RoomDef("Ауд. 303", 40, LEFT), new RoomDef("Ауд. 304", 23, LEFT),
            new RoomDef("Ауд. 305", 35, LEFT), new RoomDef("Ауд. 306", 21, LEFT),
            new RoomDef("Ауд. 307", 27, LEFT), new RoomDef("Ауд. 308", 37, LEFT),
            new RoomDef("Ауд. 309", 41, LEFT), new RoomDef("Ауд. 310", 30, LEFT),

            // ЦЕНТР
            new RoomDef("Фойе", 0, CENTER),
            new RoomDef("Лекционная аудитория", 120, CENTER), // этаж 2
            new RoomDef("Лекционная аудитория", 120, CENTER), // этаж 3

            // ПРАВЫЙ, этаж 1
            new RoomDef("Ауд. 111", 28, RIGHT), new RoomDef("Ауд. 112", 26, RIGHT),
            new RoomDef("Ауд. 113", 32, RIGHT), new RoomDef("Ауд. 114", 24, RIGHT),
            new RoomDef("Ауд. 115", 39, RIGHT), new RoomDef("Ауд. 116", 21, RIGHT),
            new RoomDef("Ауд. 117", 33, RIGHT), new RoomDef("Ауд. 118", 27, RIGHT),
            new RoomDef("Ауд. 119", 42, RIGHT), new RoomDef("Ауд. 120", 34, RIGHT),

            // ПРАВЫЙ, этаж 2
            new RoomDef("Ауд. 211", 29, RIGHT), new RoomDef("Ауд. 212", 31, RIGHT),
            new RoomDef("Ауд. 213", 36, RIGHT), new RoomDef("Ауд. 214", 23, RIGHT),
            new RoomDef("Ауд. 215", 41, RIGHT), new RoomDef("Ауд. 216", 22, RIGHT),
            new RoomDef("Ауд. 217", 34, RIGHT), new RoomDef("Ауд. 218", 28, RIGHT),
            new RoomDef("Ауд. 219", 37, RIGHT), new RoomDef("Ауд. 220", 30, RIGHT),

            // ПРАВЫЙ, этаж 3
            new RoomDef("Ауд. 311", 25, RIGHT), new RoomDef("Ауд. 312", 33, RIGHT),
            new RoomDef("Ауд. 313", 38, RIGHT), new RoomDef("Ауд. 314", 23, RIGHT),
            new RoomDef("Ауд. 315", 35, RIGHT), new RoomDef("Ауд. 316", 21, RIGHT),
            new RoomDef("Ауд. 317", 30, RIGHT), new RoomDef("Ауд. 318", 29, RIGHT),
            new RoomDef("Ауд. 319", 40, RIGHT), new RoomDef("Ауд. 320", 32, RIGHT)
    );

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // гарантируем наличие корпусов
        Building left   = ensureBuilding(LEFT);
        Building center = ensureBuilding(CENTER);
        Building right  = ensureBuilding(RIGHT);

        // мапа для быстрого выбора
        for (RoomDef d : ROOMS) {
            Building b = switch (d.getBuilding()) {
                case LEFT -> left;
                case CENTER -> center;
                case RIGHT -> right;
                default -> throw new IllegalStateException("Unknown building: " + d.getBuilding());
            };

            Classroom room = classroomRepo.findByName(d.getName())
                    .orElseGet(Classroom::new);

            room.setName(d.getName());
            room.setCapacity(d.getCapacity());
            room.setBuilding(b);

            classroomRepo.save(room);
        }
    }

    private Building ensureBuilding(String name) {
        return buildingRepo.findByName(name)
                .orElseGet(() -> buildingRepo.save(
                        Building.builder().name(name).build()
                ));
    }
}
