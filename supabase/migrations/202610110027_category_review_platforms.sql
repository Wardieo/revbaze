-- Review destinations suggested by business category.
insert into public.review_platforms(id,name,slug,icon,allowed_domains) values
 ('amazon','Amazon','amazon','AM',array['amazon.com']),
 ('etsy','Etsy','etsy','ET',array['etsy.com']),
 ('healthgrades','Healthgrades','healthgrades','HG',array['healthgrades.com']),
 ('clutch','Clutch','clutch','CL',array['clutch.co']),
 ('booking','Booking.com','booking','BK',array['booking.com']),
 ('opentable','OpenTable','opentable','OT',array['opentable.com']),
 ('fresha','Fresha','fresha','FR',array['fresha.com']),
 ('course-report','Course Report','course-report','CR',array['coursereport.com']),
 ('houzz','Houzz','houzz','HZ',array['houzz.com']),
 ('viator','Viator','viator','VI',array['viator.com'])
on conflict(id) do update set name=excluded.name, icon=excluded.icon, allowed_domains=excluded.allowed_domains;
