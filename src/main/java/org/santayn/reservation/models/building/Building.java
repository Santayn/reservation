package org.santayn.reservation.models.building;

import jakarta.persistence.*;
import lombok.*;
import org.santayn.reservation.models.user.User;

@Entity
@Table(name = "buildings", uniqueConstraints = {
        @UniqueConstraint(name = "uq_building_name", columnNames = {"name"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Building {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Название корпуса/здания
    @Column(name = "name", nullable = false, length = 255)
    private String name;

    // Ответственный администратор (пользователь)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_user_id")
    private User adminUser;
}
