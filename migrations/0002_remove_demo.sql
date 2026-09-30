-- Applied once, inside the runtime migration transaction.
-- Remove only bets explicitly marked as demo, including archived/closed examples.
DELETE FROM deliveries WHERE reminder_id IN (
 SELECT r.id FROM reminders r JOIN bets b ON b.id=r.bet_id WHERE b.demo=1
);
DELETE FROM reminders WHERE bet_id IN (SELECT id FROM bets WHERE demo=1);
DELETE FROM events WHERE bet_id IN (SELECT id FROM bets WHERE demo=1);
DELETE FROM members WHERE bet_id IN (SELECT id FROM bets WHERE demo=1);
DELETE FROM bets WHERE demo=1;

-- Keep any sample participant reused in a real bet or personalized by the owner.
-- Delete only untouched, unused original sample profiles.
DELETE FROM participants p
USING (VALUES
 ('eva','Eva','👩🏻','#ffe2d5'),
 ('lucas','Lucas','🧑🏽','#e3eaff'),
 ('lea','Léa','👩🏼','#ffe9ac'),
 ('hugo','Hugo','👨🏻','#dff0e5'),
 ('emma','Emma','👩🏽‍🦱','#f1dfff')
) AS original(id,name,avatar,color)
WHERE p.demo=1 AND p.id=original.id AND p.name=original.name
 AND p.avatar=original.avatar AND p.color=original.color
 AND NOT EXISTS(SELECT 1 FROM members m WHERE m.person_id=p.id);
UPDATE participants SET demo=0 WHERE demo=1;
