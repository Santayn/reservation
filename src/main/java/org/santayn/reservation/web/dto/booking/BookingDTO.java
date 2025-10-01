package org.santayn.reservation.web.dto.booking;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class BookingDTO {

    private Long ID;

    private Long slotID;

    private String status;

    private LocalDateTime createdAt;

    private String comment;



}
