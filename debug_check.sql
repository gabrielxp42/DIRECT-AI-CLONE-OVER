select count(*) as log_count from webhook_logs;
select * from webhook_logs order by created_at desc limit 1;
select id, email, whatsapp_instance_id from profiles;
