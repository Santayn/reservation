// org/santayn/reservation/web/controller/rest/UsersRestController.java
package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.service.UserService;
import org.santayn.reservation.web.dto.user.UpdateRoleRequest;
import org.santayn.reservation.web.dto.user.UserMeDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.santayn.reservation.web.dto.user.UserDto;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UsersRestController {
    private final UserService service;

    @GetMapping("/me")
    public ResponseEntity<UserMeDto> me(Principal principal) {
        return ResponseEntity.ok(service.me(principal));
    }

    @PutMapping("/{id}/role")
    public ResponseEntity<Void> updateRole(@PathVariable Long id, @Valid @RequestBody UpdateRoleRequest req) {
        service.updateRole(id, req);
        return ResponseEntity.ok().build();
    }


    @GetMapping
    public ResponseEntity<List<UserDto>> list() {
        return ResponseEntity.ok(service.listAll());
    }


}
